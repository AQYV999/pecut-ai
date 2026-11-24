import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_DOMAINS, isUrlAllowed } from '../api/ai/proxy.js';

test('ALLOWED_DOMAINS includes the major AI providers', () => {
  assert.ok(ALLOWED_DOMAINS.includes('openrouter.ai'));
  assert.ok(ALLOWED_DOMAINS.includes('generativelanguage.googleapis.com'));
  assert.ok(ALLOWED_DOMAINS.includes('api.groq.com'));
  assert.ok(ALLOWED_DOMAINS.includes('api.openai.com'));
  assert.ok(ALLOWED_DOMAINS.includes('api.kilo.ai'));
  assert.ok(ALLOWED_DOMAINS.includes('integrate.api.nvidia.com'));
});

test('isUrlAllowed only permits whitelisted AI provider domains', () => {
  assert.equal(isUrlAllowed('https://openrouter.ai/api/v1/chat/completions'), true);
  assert.equal(isUrlAllowed('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'), true);
  assert.equal(isUrlAllowed('https://api.groq.com/openai/v1/chat/completions'), true);
  assert.equal(isUrlAllowed('https://api.openai.com/v1/chat/completions'), true);
  assert.equal(isUrlAllowed('https://api.kilo.ai/api/gateway/chat/completions'), true);
  assert.equal(isUrlAllowed('https://integrate.api.nvidia.com/v1/chat/completions'), true);

  // Reject SSRF attempts
  assert.equal(isUrlAllowed('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isUrlAllowed('http://localhost:3000/api/ai/status'), false);
  assert.equal(isUrlAllowed('https://evil-attacker.com/proxy'), false);
  assert.equal(isUrlAllowed('javascript:alert(1)'), false);
  assert.equal(isUrlAllowed(''), false);
  assert.equal(isUrlAllowed(null), false);

  // Private networks & Cloud metadata SSRF defenses
  assert.equal(isUrlAllowed('https://10.0.0.1/api'), false, 'Must block 10.0.0.0/8 private network');
  assert.equal(isUrlAllowed('https://172.16.0.1/api'), false, 'Must block 172.16.0.0/12 private network');
  assert.equal(isUrlAllowed('https://192.168.1.1/api'), false, 'Must block 192.168.0.0/16 private network');
  assert.equal(isUrlAllowed('https://169.254.169.254/meta-data'), false, 'Must block 169.254.0.0/16 metadata');
  assert.equal(isUrlAllowed('https://metadata.google.internal/computeMetadata/v1/'), false, 'Must block GCP metadata');
  assert.equal(isUrlAllowed('https://0x7f000001/'), false, 'Must block hex loopback');
  assert.equal(isUrlAllowed('http://127.0.0.1:11434/api'), false, 'Must block loopback by default in cloud');

  // Environment-aware check: explicitly allowing local dev only when opted-in
  assert.equal(isUrlAllowed('http://localhost:11434/v1/chat/completions', { allowLocal: true }), true);
  assert.equal(isUrlAllowed('http://127.0.0.1:11434/v1/chat/completions', { allowLocal: true }), true);
  assert.equal(isUrlAllowed('http://localhost:11434/v1/chat/completions', { allowLocal: false }), false);
});

test('handleProxyRequest rejects missing x-target-url with 400', async () => {
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer test' },
    on: (evt, cb) => { if (evt === 'end') cb(); }
  };
  let statusCode = 0;
  let responseData = '';
  const res = {
    writeHead: (status) => { statusCode = status; },
    end: (data) => { responseData = data; }
  };

  const { handleProxyRequest } = await import('../api/ai/proxy.js');
  await handleProxyRequest(req, res);

  assert.equal(statusCode, 400);
  assert.ok(responseData.includes('Missing required header: x-target-url'));
});

test('handleProxyRequest rejects disallowed target domain with 403', async () => {
  const req = {
    method: 'POST',
    headers: {
      'x-target-url': 'http://169.254.169.254/latest/meta-data',
      authorization: 'Bearer test'
    },
    on: (evt, cb) => { if (evt === 'end') cb(); }
  };
  let statusCode = 0;
  let responseData = '';
  const res = {
    writeHead: (status) => { statusCode = status; },
    end: (data) => { responseData = data; }
  };

  const { handleProxyRequest } = await import('../api/ai/proxy.js');
  await handleProxyRequest(req, res);

  assert.equal(statusCode, 403);
  assert.ok(responseData.includes('Forbidden: Target URL domain is not in the allowed AI provider list.'));
});

test('handleProxyRequest rejects missing Authorization header with 400', async () => {
  const req = {
    method: 'POST',
    headers: {
      'x-target-url': 'https://openrouter.ai/api/v1/chat/completions'
    },
    on: (evt, cb) => { if (evt === 'end') cb(); }
  };
  let statusCode = 0;
  let responseData = '';
  const res = {
    writeHead: (status) => { statusCode = status; },
    end: (data) => { responseData = data; }
  };

  const { handleProxyRequest } = await import('../api/ai/proxy.js');
  await handleProxyRequest(req, res);

  assert.equal(statusCode, 400);
  assert.ok(responseData.includes('Missing required Authorization'));
});

test('handleProxyRequest forwards GET requests cleanly', async () => {
  const req = {
    method: 'GET',
    headers: {
      'x-target-url': 'https://api.groq.com/openai/v1/models',
      authorization: 'Bearer gsk_test'
    }
  };
  let statusCode = 0;
  let responseData = '';
  const res = {
    writeHead: (status) => { statusCode = status; },
    end: (data) => { responseData = data; }
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    assert.equal(opts.method, 'GET');
    return {
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ data: [{ id: 'qwen/qwen3.8-27b' }] })
    };
  };

  try {
    const { handleProxyRequest } = await import('../api/ai/proxy.js');
    await handleProxyRequest(req, res);
    assert.equal(statusCode, 200);
    assert.ok(responseData.includes('qwen/qwen3.8-27b'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleProxyRequest rejects upstream redirects to internal metadata with 403', async () => {
  const req = {
    method: 'POST',
    headers: {
      'x-target-url': 'https://openrouter.ai/api/v1/chat/completions',
      authorization: 'Bearer test'
    },
    on: (evt, cb) => { if (evt === 'end') cb(); }
  };
  let statusCode = 0;
  let responseData = '';
  const res = {
    writeHead: (status) => { statusCode = status; },
    end: (data) => { responseData = data; }
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    // Simulate upstream returning 302 redirecting to internal metadata IP
    return {
      status: 302,
      headers: {
        get: (h) => (h.toLowerCase() === 'location' ? 'http://169.254.169.254/latest/meta-data' : null)
      },
      text: async () => ''
    };
  };

  try {
    const { handleProxyRequest } = await import('../api/ai/proxy.js');
    await handleProxyRequest(req, res);
    assert.equal(statusCode, 403, 'Must reject redirect to metadata IP with 403');
    assert.ok(responseData.includes('Forbidden: Upstream redirected to a disallowed or non-allowlisted destination.'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
