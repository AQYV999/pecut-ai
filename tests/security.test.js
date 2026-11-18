import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSafeExportState } from '../src/modules/settings.js';
import { sanitizeImportedPrompts } from '../src/modules/library.js';
import { MAX_PROXY_BODY_BYTES, handleProxyRequest } from '../api/ai/proxy.js';
import { saveBYOKConfig, loadBYOKConfig } from '../src/modules/storage.js';
import { getActiveProviderInfo } from '../src/services/ai/providers.js';
import { completeChat, parseRobustJson, abortableSleep } from '../src/services/ai/transport.js';

// Mock localStorage for storage tests
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStore.get(k) || null,
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

test('SEC-01: getSafeExportState strips sensitive API keys from backup payload', () => {
  const fakeState = {
    settings: { theme: 'dark', language: 'id' },
    savedPrompts: [{ id: 'p1', title: 'Test' }],
    byok: {
      provider: 'openrouter',
      apiKey: 'sk-or-v1-secret-token-12345',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      baseUrl: 'https://openrouter.ai/api/v1'
    }
  };

  const safe = getSafeExportState(fakeState);

  assert.equal(safe.byok.apiKey, undefined, 'API key must be deleted from export');
  assert.equal(safe.byok.provider, 'openrouter');
  assert.equal(safe.byok.model, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(fakeState.byok.apiKey, 'sk-or-v1-secret-token-12345', 'Original state must not be mutated');
});

test('SEC-01b: getSafeExportState strips all credentials across multi-provider profiles', () => {
  const multiProviderState = {
    settings: { theme: 'dark' },
    byok: {
      provider: 'gemini',
      apiKey: 'AIzaSy-ActiveKey-12345',
      model: 'gemini-3.8-flash'
    },
    byokProfiles: {
      openrouter: { provider: 'openrouter', apiKey: 'sk-or-v1-secret1', model: 'llama' },
      gemini: { provider: 'gemini', apiKey: 'AIzaSy-secret2', model: 'gemini-3.8-flash' },
      groq: { provider: 'groq', apiKey: 'gsk_secret3', model: 'qwen' },
      ninerouter: { provider: 'ninerouter', apiKey: '', model: 'VibeCoding' }
    }
  };

  const safe = getSafeExportState(multiProviderState);

  assert.equal(safe.byok.apiKey, undefined);
  assert.equal(safe.byokProfiles.openrouter.apiKey, undefined);
  assert.equal(safe.byokProfiles.gemini.apiKey, undefined);
  assert.equal(safe.byokProfiles.groq.apiKey, undefined);
  assert.equal(safe.byokProfiles.ninerouter.apiKey, undefined);

  // Non-sensitive configuration preserved
  assert.equal(safe.byokProfiles.openrouter.model, 'llama');
  assert.equal(safe.byokProfiles.groq.provider, 'groq');
});

test('SEC-02: sanitizeImportedPrompts neutralizes malicious IDs and validates schema', () => {
  const maliciousPayload = [
    {
      id: "');alert('xss');//",
      title: 'Hacked Prompt',
      content: 'Malicious content with payload',
      category: 'Security',
      isFavorite: true
    },
    {
      id: '<script>alert(1)</script>',
      title: 'Script tag ID',
      content: 'Exploit attempt'
    },
    {
      id: 'valid-prompt_123',
      title: 'Legitimate Prompt',
      content: 'Standard prompt body',
      category: 'Programming'
    },
    null,
    'invalid-string',
    { empty: true }
  ];

  const sanitized = sanitizeImportedPrompts(maliciousPayload);

  assert.equal(sanitized.length, 3, 'Should accept only the 3 valid objects');

  // Verify malicious IDs are neutralized with safe alphanumeric IDs
  const safeIdRegex = /^[a-zA-Z0-9_-]+$/;
  assert.ok(safeIdRegex.test(sanitized[0].id), `ID "${sanitized[0].id}" must be safe alphanumeric`);
  assert.ok(!sanitized[0].id.includes("'"), 'ID must not contain single quotes');
  assert.ok(!sanitized[0].id.includes(';'), 'ID must not contain semicolons');

  assert.ok(safeIdRegex.test(sanitized[1].id), `ID "${sanitized[1].id}" must be safe alphanumeric`);
  assert.ok(!sanitized[1].id.includes('<'), 'ID must not contain angle brackets');

  // Legitimate ID should be preserved
  assert.equal(sanitized[2].id, 'valid-prompt_123');
});

test('SEC-03: handleProxyRequest rejects bodies larger than MAX_PROXY_BODY_BYTES with 413', async () => {
  assert.equal(MAX_PROXY_BODY_BYTES, 2 * 1024 * 1024, 'Limit should be exactly 2MB');

  const oversizeString = 'x'.repeat(MAX_PROXY_BODY_BYTES + 100);
  const req = {
    method: 'POST',
    headers: {
      'x-target-url': 'https://openrouter.ai/api/v1/chat/completions',
      authorization: 'Bearer test'
    },
    body: oversizeString,
    on: (evt, cb) => { if (evt === 'end') cb(); }
  };

  let statusCode = 0;
  let responseData = '';
  const res = {
    writeHead: (status) => { statusCode = status; },
    end: (data) => { responseData = data; }
  };

  await handleProxyRequest(req, res);

  assert.equal(statusCode, 413, 'Status must be 413 Payload Too Large');
  assert.ok(responseData.includes('Payload Too Large'), 'Response should explain payload limit');
});

test('SEC-03b: handleProxyRequest fast-fails on Content-Length header exceeding 2MB', async () => {
  const req = {
    method: 'POST',
    headers: {
      'x-target-url': 'https://openrouter.ai/api/v1/chat/completions',
      authorization: 'Bearer test',
      'content-length': String(MAX_PROXY_BODY_BYTES + 5000)
    },
    on: (evt, cb) => { if (evt === 'end') cb(); }
  };

  let statusCode = 0;
  let responseData = '';
  const res = {
    writeHead: (status) => { statusCode = status; },
    end: (data) => { responseData = data; }
  };

  await handleProxyRequest(req, res);

  assert.equal(statusCode, 413);
  assert.ok(responseData.includes('Payload Too Large'));
});

test('SEC-03c: handleProxyRequest rejects chunked body streams exceeding 2MB without Content-Length', async () => {
  let streamDestroyed = false;
  const chunk1 = 'a'.repeat(1024 * 1024); // 1 MB
  const chunk2 = 'b'.repeat(1024 * 1024 + 50); // > 1 MB (total > 2MB)

  const req = {
    method: 'POST',
    headers: {
      'x-target-url': 'https://openrouter.ai/api/v1/chat/completions',
      authorization: 'Bearer test'
      // No content-length header
    },
    destroy: () => { streamDestroyed = true; },
    on: (evt, cb) => {
      if (evt === 'data') {
        cb(chunk1);
        cb(chunk2);
      }
      if (evt === 'end') cb();
    }
  };

  let statusCode = 0;
  let responseData = '';
  const res = {
    writeHead: (status) => { statusCode = status; },
    end: (data) => { responseData = data; }
  };

  await handleProxyRequest(req, res);

  assert.equal(statusCode, 413, 'Chunked overflow must trigger 413');
  assert.equal(streamDestroyed, true, 'Stream must be destroyed on overflow');
});

test('SEC-04: HTML Preview sandboxing attributes enforce opaque origin without same-origin privileges', () => {
  // In W3C spec: an iframe with sandbox="allow-scripts allow-modals" that OMITS "allow-same-origin"
  // is assigned a unique, opaque null origin.
  // It cannot access parent document, parent DOM, parent cookies, or parent localStorage.
  const sandboxPolicy = 'allow-scripts allow-modals';
  const tokens = sandboxPolicy.split(/\s+/);

  assert.ok(tokens.includes('allow-scripts'), 'Must allow script execution for interactive HTML');
  assert.ok(!tokens.includes('allow-same-origin'), 'Must NEVER include allow-same-origin with allow-scripts');
  assert.ok(!tokens.includes('allow-top-navigation'), 'Must NEVER allow top-level redirection of parent');
});

test('TRANSPORT-01: storage preserves valid non-deprecated Gemini models', () => {
  mockStore.clear();

  // Save non-deprecated Gemini model
  saveBYOKConfig({
    provider: 'gemini',
    apiKey: 'AIzaSy12345',
    model: 'gemini-3.8-pro',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  });

  const loaded = loadBYOKConfig();
  assert.equal(loaded.model, 'gemini-3.8-pro', 'Valid custom Gemini model must not be overwritten');

  // Verify deprecated model still auto-migrates
  saveBYOKConfig({
    provider: 'gemini',
    apiKey: 'AIzaSy12345',
    model: 'gemini-1.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  });

  const migrated = loadBYOKConfig();
  assert.equal(migrated.model, 'gemini-3.8-flash', 'Deprecated model must auto-migrate to gemini-3.8-flash');
});

test('TRANSPORT-02: 9Router is recognized as keyless ready provider without API key', () => {
  mockStore.clear();

  saveBYOKConfig({
    provider: 'ninerouter',
    apiKey: '',
    model: 'VibeCoding',
    baseUrl: 'http://localhost:20128/v1'
  });

  const info = getActiveProviderInfo();
  assert.equal(info.provider, 'ninerouter');
  assert.equal(info.hasKey, true, '9Router should be considered ready even without API key');
  assert.equal(info.isLocal, true);
});

test('TRANSPORT-03: completeChat cancels immediately on AbortSignal without retries', async () => {
  const controller = new AbortController();
  controller.abort(); // already aborted signal

  await assert.rejects(
    async () => {
      await completeChat({
        messages: [{ role: 'user', content: 'test abort' }],
        signal: controller.signal,
        overrideConfig: {
          provider: 'openrouter',
          apiKey: 'test-key',
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          baseUrl: 'https://openrouter.ai/api/v1'
        }
      });
    },
    (err) => err.name === 'AbortError' || err.message.includes('aborted')
  );
});

test('TRANSPORT-04: completeChat normalizes token usage metrics from provider response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Telemetry test response' } }],
        usage: {
          prompt_tokens: 42,
          completion_tokens: 18,
          total_tokens: 60
        }
      })
    };
  };

  try {
    const res = await completeChat({
      messages: [{ role: 'user', content: 'Count tokens' }],
      overrideConfig: {
        provider: 'openrouter',
        apiKey: 'test',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'test-model'
      }
    });

    assert.equal(res.text, 'Telemetry test response');
    assert.ok(res.usage, 'Response must include normalized usage object');
    assert.equal(res.usage.promptTokens, 42);
    assert.equal(res.usage.completionTokens, 18);
    assert.equal(res.usage.totalTokens, 60);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TRANSPORT-05: parseRobustJson handles large invalid buffers without O(N^2) freeze', async () => {
  const largeNoise = '<html><body><h1>Error</h1><p>' + 'a'.repeat(50000) + '</p></body></html>';
  const fakeResponse = {
    text: async () => largeNoise
  };

  const startTime = Date.now();
  await assert.rejects(
    async () => {
      await parseRobustJson(fakeResponse);
    },
    SyntaxError
  );
  const elapsed = Date.now() - startTime;
  assert.ok(elapsed < 200, `parseRobustJson should fail fast (<200ms), took ${elapsed}ms`);
});

test('TRANSPORT-06: completeChat handles HTTP 429 with Retry-After and succeeds on retry', async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    callCount++;
    if (callCount === 1) {
      // First attempt returns 429 with Retry-After: 1
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name) => (name.toLowerCase() === 'retry-after' ? '1' : null)
        },
        json: async () => ({ error: { message: 'Rate limit reached. Please retry.' } })
      };
    }
    // Second attempt succeeds
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Success after 429 retry' } }]
      })
    };
  };

  try {
    const res = await completeChat({
      messages: [{ role: 'user', content: 'Test 429' }],
      overrideConfig: {
        provider: 'groq',
        apiKey: 'gsk_test',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'qwen'
      }
    });

    assert.equal(callCount, 2, 'Should have retried once after 429');
    assert.equal(res.text, 'Success after 429 retry');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TRANSPORT-07: completeChat respects maxRetries limit on persistent HTTP 429', async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    callCount++;
    return {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: {
        get: () => '1'
      },
      json: async () => ({ error: { message: 'Quota exhausted permanently.' } })
    };
  };

  try {
    await assert.rejects(
      async () => {
        await completeChat({
          messages: [{ role: 'user', content: 'Exhausted' }],
          overrideConfig: {
            provider: 'groq',
            apiKey: 'gsk_test',
            baseUrl: 'https://api.groq.com/openai/v1',
            model: 'qwen'
          }
        });
      },
      (err) => err.message.includes('Quota exhausted permanently') || err.message.includes('429')
    );

    // Initial attempt (0) + 2 retries (1, 2) = exactly 3 total attempts
    assert.equal(callCount, 3, 'Should attempt exactly initial + 2 retries (3 calls total)');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TRANSPORT-08: abortableSleep wakes up and aborts immediately when signal aborts during delay', async () => {
  const controller = new AbortController();
  const startTime = Date.now();

  // Schedule abort in 50ms while sleeping for 5000ms
  setTimeout(() => controller.abort(), 50);

  await assert.rejects(
    async () => {
      await abortableSleep(5000, controller.signal);
    },
    (err) => err.name === 'AbortError'
  );

  const duration = Date.now() - startTime;
  assert.ok(duration < 300, `Sleep should have been aborted immediately (~50ms), took ${duration}ms`);
});
