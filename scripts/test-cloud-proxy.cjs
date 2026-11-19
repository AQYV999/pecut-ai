const https = require('https');
const { execSync } = require('child_process');

let bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (!bypassSecret) {
  try {
    const raw = execSync('npx vercel api /v9/projects/prj_laFwdu8v6bclC2eHXRvPa9dDyVvh', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const match = raw.match(/"protectionBypass":\{"([^"]+)"/);
    if (match && match[1]) bypassSecret = match[1];
  } catch (_) {}
}

const STAGING_HOST = 'pecut-ai-git-staging-pecut-ai-19-kel-4.vercel.app';
const PROXY_PATH = '/api/ai/proxy';

function requestProxy({ method = 'POST', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const reqHeaders = {
      ...headers,
      'x-vercel-protection-bypass': bypassSecret || '',
    };
    if (body && !reqHeaders['content-length'] && typeof body === 'string') {
      reqHeaders['content-length'] = Buffer.byteLength(body);
    }

    const req = https.request({
      hostname: STAGING_HOST,
      port: 443,
      path: PROXY_PATH,
      method,
      headers: reqHeaders,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runSecurityAudit() {
  console.log(`Starting Cloud Proxy Security Verification against https://${STAGING_HOST}${PROXY_PATH}`);
  const results = [];

  async function test(name, description, reqOpts, evaluate) {
    process.stdout.write(`Testing: ${name}... `);
    try {
      const res = await requestProxy(reqOpts);
      const passed = evaluate(res);
      const outcome = {
        name,
        description,
        statusCode: res.statusCode,
        bodyPreview: res.body.slice(0, 150),
        passed: !!passed,
      };
      results.push(outcome);
      console.log(passed ? 'PASS' : 'FAIL');
      if (!passed) {
        console.log(`  -> Got ${res.statusCode}: ${res.body.slice(0, 100)}`);
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({ name, description, statusCode: 0, error: err.message, passed: false });
    }
  }

  // 1. Missing target URL
  await test(
    'REQ-01: Missing x-target-url',
    'Rejects request missing x-target-url with 400',
    { method: 'POST', headers: { 'authorization': 'Bearer test' } },
    res => res.statusCode === 400 && res.body.includes('Missing required header: x-target-url')
  );

  // 2. Missing authorization
  await test(
    'REQ-02: Missing Authorization header',
    'Rejects request missing auth with 400',
    { method: 'POST', headers: { 'x-target-url': 'https://openrouter.ai/api/v1/chat/completions' } },
    res => res.statusCode === 400 && res.body.includes('Missing required Authorization')
  );

  // 3. Disallowed external domain (anti-SSRF)
  await test(
    'SSRF-01: Arbitrary external domain',
    'Blocks non-whitelisted domain (evil.com) with 403',
    {
      method: 'POST',
      headers: {
        'x-target-url': 'https://evil.com/steal-data',
        'authorization': 'Bearer test'
      }
    },
    res => res.statusCode === 403 && res.body.includes('Forbidden: Target URL domain is not in the allowed AI provider list')
  );

  // 4. Localhost name
  await test(
    'SSRF-02: Localhost hostname',
    'Blocks localhost destination in cloud mode with 403',
    {
      method: 'POST',
      headers: {
        'x-target-url': 'http://localhost:20128/v1/chat',
        'authorization': 'Bearer test'
      }
    },
    res => res.statusCode === 403
  );

  // 5. Loopback IPv4
  await test(
    'SSRF-03: Loopback IPv4 (127.0.0.1)',
    'Blocks 127.0.0.1 destination with 403',
    {
      method: 'POST',
      headers: {
        'x-target-url': 'http://127.0.0.1:8080/admin',
        'authorization': 'Bearer test'
      }
    },
    res => res.statusCode === 403
  );

  // 6. Cloud Metadata IP (169.254.169.254)
  await test(
    'SSRF-04: AWS/GCP/Azure Metadata IP (169.254.169.254)',
    'Blocks cloud metadata IP link-local destination with 403',
    {
      method: 'POST',
      headers: {
        'x-target-url': 'http://169.254.169.254/latest/meta-data/',
        'authorization': 'Bearer test'
      }
    },
    res => res.statusCode === 403
  );

  // 7. Google Internal Cloud Metadata
  await test(
    'SSRF-05: Google Cloud internal metadata host',
    'Blocks metadata.google.internal destination with 403',
    {
      method: 'POST',
      headers: {
        'x-target-url': 'http://metadata.google.internal/computeMetadata/v1/',
        'authorization': 'Bearer test'
      }
    },
    res => res.statusCode === 403
  );

  // 8. RFC 1918 Private IP (10.x.x.x)
  await test(
    'SSRF-06: Private Network RFC 1918 (10.0.0.1)',
    'Blocks private 10.0.0.1 network destination with 403',
    {
      method: 'POST',
      headers: {
        'x-target-url': 'http://10.0.0.1/status',
        'authorization': 'Bearer test'
      }
    },
    res => res.statusCode === 403
  );

  // 9. RFC 1918 Private IP (192.168.x.x)
  await test(
    'SSRF-07: Private Network RFC 1918 (192.168.1.1)',
    'Blocks private 192.168.1.1 network destination with 403',
    {
      method: 'POST',
      headers: {
        'x-target-url': 'http://192.168.1.1/router-config',
        'authorization': 'Bearer test'
      }
    },
    res => res.statusCode === 403
  );

  // 10. Unencrypted HTTP target in cloud mode
  await test(
    'TLS-01: Plaintext HTTP to allowed domain',
    'Blocks unencrypted http:// destination even for allowed domains in cloud mode with 403',
    {
      method: 'POST',
      headers: {
        'x-target-url': 'http://openrouter.ai/api/v1/chat/completions',
        'authorization': 'Bearer test'
      }
    },
    res => res.statusCode === 403
  );

  // 11. Payload size limit (> 2MB)
  const largeBody = 'x'.repeat(2 * 1024 * 1024 + 1024);
  await test(
    'DOS-01: Body > 2MB Limit Enforcement',
    'Rejects request body > 2MB with 413',
    {
      method: 'POST',
      headers: {
        'x-target-url': 'https://openrouter.ai/api/v1/chat/completions',
        'authorization': 'Bearer test',
      },
      body: largeBody
    },
    res => res.statusCode === 413 && res.body.includes('Payload Too Large')
  );

  // 12. CORS Preflight OPTIONS
  await test(
    'CORS-01: OPTIONS preflight',
    'Returns 204 with CORS allow headers for preflight request',
    { method: 'OPTIONS' },
    res => res.statusCode === 204 && res.headers['access-control-allow-origin'] === '*' && res.headers['access-control-allow-methods'].includes('POST')
  );

  // 13. Method Not Allowed (PUT)
  await test(
    'MTHD-01: Unsupported HTTP method (PUT)',
    'Returns 405 Method Not Allowed for PUT requests',
    {
      method: 'PUT',
      headers: {
        'x-target-url': 'https://openrouter.ai/api/v1/chat/completions',
        'authorization': 'Bearer test'
      }
    },
    res => res.statusCode === 405 && res.body.includes('Method Not Allowed')
  );

  console.log('\n--- SECURITY AUDIT SUMMARY ---');
  const allPassed = results.every(r => r.passed);
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.passed).length}`);
  console.log(`Failed: ${results.filter(r => !r.passed).length}`);
  console.log(`Overall Result: ${allPassed ? 'ALL PASS' : 'FAILURES DETECTED'}`);

  return results;
}

runSecurityAudit();
