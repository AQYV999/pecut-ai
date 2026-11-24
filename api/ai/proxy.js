/**
 * Pecut AI — Universal Serverless AI Proxy
 * Apache-2.0 License
 *
 * Forwards client requests to whitelisted AI providers to eliminate browser CORS
 * while keeping zero secrets or tokens on server disk or database.
 */

export const ALLOWED_DOMAINS = [
  'openrouter.ai',
  'generativelanguage.googleapis.com',
  'api.groq.com',
  'api.openai.com',
  'api.kilo.ai',
  'ai-gateway.kilo.ai',
  'kilo.ai',
  'integrate.api.nvidia.com',
  'api.nvidia.com',
  'nvidia.com',
  '9router.com',
  'trycloudflare.com',
  'loca.lt',
  'ngrok-free.app',
  'ngrok.io',
  'ts.net',
  'abc-tunnel.us'
];

export const MAX_PROXY_BODY_BYTES = 2 * 1024 * 1024; // 2 MB limit to prevent buffer exhaustion DoS

/**
 * Checks whether an IP or hostname is private, loopback, or cloud metadata.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isPrivateOrMetadataHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const host = hostname.toLowerCase().trim();

  // 1. Loopback & Localhost names
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host === '[::1]' || host.endsWith('.localhost')) {
    return true;
  }

  // 2. Cloud Metadata hosts (AWS, GCP, Azure, OpenStack)
  if (host === 'metadata.google.internal' || host === '169.254.169.254' || host === 'metadata') {
    return true;
  }

  // 3. IPv4 pattern matching
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const o1 = parseInt(ipv4Match[1], 10);
    const o2 = parseInt(ipv4Match[2], 10);
    const o3 = parseInt(ipv4Match[3], 10);
    const o4 = parseInt(ipv4Match[4], 10);
    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) return true;

    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) return true;
    // 0.0.0.0/8 (Broadcast/This network)
    if (o1 === 0) return true;
    // 10.0.0.0/8 (Private RFC 1918)
    if (o1 === 10) return true;
    // 172.16.0.0/12 (Private RFC 1918)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    // 192.168.0.0/16 (Private RFC 1918)
    if (o1 === 192 && o2 === 168) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata RFC 3927)
    if (o1 === 169 && o2 === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT RFC 6598)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;
  }

  // Hex / Dword IP representations (e.g. 0x7f000001, 2130706433)
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d{8,10}$/.test(host)) {
    return true;
  }

  // 4. IPv6 Link-Local and ULA
  if (host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb') ||
      host.startsWith('fc') || host.startsWith('fd') || host === '::' || host === '::1') {
    return true;
  }

  return false;
}

/**
 * Validates whether a target URL is in the domain allowlist (Anti-SSRF).
 * @param {string} urlString
 * @param {Object} [options]
 * @param {boolean} [options.allowLocal] - Explicit flag to allow local development destinations
 * @returns {boolean}
 */
export function isUrlAllowed(urlString, options = {}) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString);

    // Environment-aware check:
    // Localhost allowed ONLY when explicitly configured via environment or options
    const isLocalDevExplicitlyAllowed = (typeof options.allowLocal === 'boolean')
      ? options.allowLocal
      : (process.env.ALLOW_LOCAL_PROXY === 'true');

    const host = parsed.hostname.toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

    if (isLocalHost) {
      if (isLocalDevExplicitlyAllowed) {
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      }
      return false; // Blocked in cloud / default deployments
    }

    // In cloud / production, MUST use https
    if (parsed.protocol !== 'https:') return false;

    // Block private networks, loopbacks, and cloud metadata destinations
    if (isPrivateOrMetadataHost(host)) return false;

    // Check allowlisted domains
    return ALLOWED_DOMAINS.some(allowed => host === allowed || host.endsWith('.' + allowed));
  } catch (_) {
    return false;
  }
}

/**
 * Core proxy request handler compatible with both Node HTTP and Vercel Serverless.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function handleProxyRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-target-url, x-goog-api-key',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed. Use GET or POST.' }));
  }

  const targetUrl = req.headers['x-target-url'];
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Missing required header: x-target-url' }));
  }

  if (!isUrlAllowed(targetUrl)) {
    res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      error: 'Forbidden: Target URL domain is not in the allowed AI provider list.',
      allowedDomains: ALLOWED_DOMAINS
    }));
  }

  const authHeader = req.headers['authorization'];
  const googKeyHeader = req.headers['x-goog-api-key'];
  if (!authHeader && !googKeyHeader) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Missing required Authorization or x-goog-api-key header.' }));
  }

  // Parse body only for POST
  let bodyBuffer = null;
  if (req.method === 'POST') {
    // Fast-fail: Reject upfront if Content-Length header exceeds limit
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > MAX_PROXY_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Payload Too Large: Proxy limits request body to 2MB.' }));
    }

    if (req.body && typeof req.body === 'object') {
      bodyBuffer = JSON.stringify(req.body);
    } else if (typeof req.body === 'string') {
      bodyBuffer = req.body;
    } else {
      let isTooLarge = false;
      bodyBuffer = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => {
          data += chunk;
          if (data.length > MAX_PROXY_BODY_BYTES) {
            isTooLarge = true;
            if (typeof req.destroy === 'function') req.destroy();
            resolve(null);
          }
        });
        req.on('end', () => resolve(data));
        req.on('error', () => resolve(''));
      });

      if (isTooLarge) {
        res.writeHead(413, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ error: 'Payload Too Large: Proxy limits request body to 2MB.' }));
      }
    }

    if (bodyBuffer && bodyBuffer.length > MAX_PROXY_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Payload Too Large: Proxy limits request body to 2MB.' }));
    }
  }

  try {
    const upstreamHeaders = {
      'Content-Type': 'application/json'
    };
    if (authHeader) upstreamHeaders['Authorization'] = authHeader;
    if (googKeyHeader) upstreamHeaders['x-goog-api-key'] = googKeyHeader;

    const fetchOptions = {
      method: req.method,
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(55000),
      redirect: 'manual'
    };
    if (req.method === 'POST' && bodyBuffer) {
      fetchOptions.body = bodyBuffer;
    }

    let upstreamRes = await fetch(targetUrl, fetchOptions);

    // Prevent redirect-based SSRF bypass: validate redirect target against isUrlAllowed
    if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
      const redirectLocation = upstreamRes.headers.get('location');
      if (redirectLocation) {
        const resolvedRedirect = new URL(redirectLocation, targetUrl).toString();
        if (isUrlAllowed(resolvedRedirect)) {
          upstreamRes = await fetch(resolvedRedirect, fetchOptions);
        } else {
          res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            error: 'Forbidden: Upstream redirected to a disallowed or non-allowlisted destination.'
          }));
        }
      }
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/json';

    // Support real-time Server-Sent Events (SSE) streaming
    if (upstreamRes.status >= 200 && upstreamRes.status < 300 && contentType.includes('text/event-stream')) {
      res.writeHead(upstreamRes.status, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      });

      if (upstreamRes.body && typeof upstreamRes.body.getReader === 'function') {
        const reader = upstreamRes.body.getReader();
        const onReqClose = () => {
          try { reader.cancel(); } catch (_) {}
        };
        if (typeof req.on === 'function') req.on('close', onReqClose);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (typeof res.write === 'function') res.write(value);
            if (typeof res.flush === 'function') res.flush();
          }
        } finally {
          if (typeof req.off === 'function') {
            req.off('close', onReqClose);
          } else if (typeof req.removeListener === 'function') {
            req.removeListener('close', onReqClose);
          }
          res.end();
        }
        return;
      }

      if (upstreamRes.body && typeof upstreamRes.body.pipe === 'function') {
        upstreamRes.body.pipe(res);
        return;
      }
    }

    const responseText = await upstreamRes.text();
    res.writeHead(upstreamRes.status, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(responseText);
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const status = isTimeout ? 504 : 502;
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      error: isTimeout ? 'Gateway Timeout: AI provider took longer than 55 seconds.' : `Proxy Error: ${err.message}`
    }));
  }
}

// Default export for Vercel Serverless Function
export default handleProxyRequest;
