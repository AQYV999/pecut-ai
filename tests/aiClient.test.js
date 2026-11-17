import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLocalOrigin, buildChatPayload } from '../src/services/ai/client.js';

test('isLocalOrigin correctly detects localhost and 127.0.0.1', () => {
  assert.equal(isLocalOrigin('http://localhost:11434/v1'), true);
  assert.equal(isLocalOrigin('http://127.0.0.1:8000/v1'), true);
  assert.equal(isLocalOrigin('http://localhost:3000'), true);
  assert.equal(isLocalOrigin('https://openrouter.ai/api/v1'), false);
  assert.equal(isLocalOrigin('https://api.openai.com/v1'), false);
  assert.equal(isLocalOrigin(''), false);
  assert.equal(isLocalOrigin(null), false);
});

test('buildChatPayload formats systemPrompt and messages into OpenAI format', () => {
  const payload = buildChatPayload({
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    systemPrompt: 'You are Pecut AI.',
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 0.3,
    maxTokens: 1000
  });

  assert.equal(payload.model, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(payload.messages[0].role, 'system');
  assert.equal(payload.messages[0].content, 'You are Pecut AI.');
  assert.equal(payload.messages[1].role, 'user');
  assert.equal(payload.messages[1].content, 'Hello');
  assert.equal(payload.temperature, 0.3);
  assert.equal(payload.max_tokens, 1000);
});

test('buildChatPayload handles missing systemPrompt gracefully', () => {
  const payload = buildChatPayload({
    model: 'gemini-1.5-flash',
    messages: [{ role: 'user', content: 'Test prompt' }]
  });

  assert.equal(payload.messages.length, 1);
  assert.equal(payload.messages[0].role, 'user');
  assert.equal(payload.messages[0].content, 'Test prompt');
});

test('completeChat builds request without ReferenceError and uses configured model', async () => {
  const { completeChat } = await import('../src/services/ai/client.js');
  
  // Mock global fetch to intercept the request and verify payload
  const originalFetch = globalThis.fetch;
  let interceptedUrl = '';
  let interceptedBody = null;

  globalThis.fetch = async (url, options) => {
    interceptedUrl = url;
    interceptedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: 'Test response from mock' } }
        ]
      })
    };
  };

  try {
    const res = await completeChat({
      messages: [{ role: 'user', content: 'test ping' }],
      overrideConfig: {
        provider: 'gemini',
        apiKey: 'AIzaSyMockKey',
        model: 'gemini-2.5-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
      }
    });

    assert.equal(res.text, 'Test response from mock');
    assert.equal(res.model, 'gemini-2.5-flash');
    assert.equal(interceptedBody.model, 'gemini-2.5-flash');
    assert.equal(interceptedUrl, '/api/ai/proxy');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
