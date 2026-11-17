import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_DOMAINS, isUrlAllowed } from '../api/ai/proxy.js';

test('ALLOWED_DOMAINS includes the major AI providers', () => {
  assert.ok(ALLOWED_DOMAINS.includes('openrouter.ai'));
  assert.ok(ALLOWED_DOMAINS.includes('generativelanguage.googleapis.com'));
  assert.ok(ALLOWED_DOMAINS.includes('api.groq.com'));
  assert.ok(ALLOWED_DOMAINS.includes('api.openai.com'));
});

test('isUrlAllowed only permits whitelisted AI provider domains', () => {
  assert.equal(isUrlAllowed('https://openrouter.ai/api/v1/chat/completions'), true);
  assert.equal(isUrlAllowed('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'), true);
  assert.equal(isUrlAllowed('https://api.groq.com/openai/v1/chat/completions'), true);
  assert.equal(isUrlAllowed('https://api.openai.com/v1/chat/completions'), true);

  // Reject SSRF attempts
  assert.equal(isUrlAllowed('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isUrlAllowed('http://localhost:3000/api/ai/status'), false);
  assert.equal(isUrlAllowed('https://evil-attacker.com/proxy'), false);
  assert.equal(isUrlAllowed('javascript:alert(1)'), false);
  assert.equal(isUrlAllowed(''), false);
  assert.equal(isUrlAllowed(null), false);
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
  assert.ok(responseData.includes('Missing required Authorization header'));
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
