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
        model: 'gemini-3.8-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
      }
    });

    assert.equal(res.text, 'Test response from mock');
    assert.equal(res.model, 'gemini-3.8-flash');
    assert.equal(interceptedBody.model, 'gemini-3.8-flash');
    assert.equal(interceptedUrl, '/api/ai/proxy');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testAIConnection executes successfully and returns formatted status', async () => {
  const { testAIConnection } = await import('../src/services/ai/client.js');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: 'pong' } }]
    })
  });

  try {
    const result = await testAIConnection({
      provider: 'gemini',
      apiKey: 'AIzaSyMockKey',
      model: 'gemini-1.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
    });
    assert.equal(result.success, true);
    assert.match(result.message, /Connected successfully to gemini/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchProviderModels queries Gemini models using x-goog-api-key', async () => {
  const { fetchProviderModels } = await import('../src/services/ai/client.js');
  const originalFetch = globalThis.fetch;
  let interceptedHeaders = {};

  globalThis.fetch = async (url, opts) => {
    interceptedHeaders = opts.headers;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding-004', displayName: 'Text Embedding 004', supportedGenerationMethods: ['embedContent'] }
        ]
      })
    };
  };

  try {
    const list = await fetchProviderModels({
      provider: 'gemini',
      apiKey: 'AIzaSyGeminiKey123'
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'gemini-3.8-flash');
    assert.equal(interceptedHeaders['x-goog-api-key'], 'AIzaSyGeminiKey123');
    assert.equal(interceptedHeaders['Authorization'], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchProviderModels queries 9Router models and maps id and name properly', async () => {
  const { fetchProviderModels } = await import('../src/services/ai/client.js');
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        object: 'list',
        data: [
          { id: 'VibeCoding', object: 'model', owned_by: 'combo' },
          { id: 'groq/qwen/qwen3.8-27b', object: 'model', owned_by: 'groq' }
        ]
      })
    };
  };

  try {
    const list = await fetchProviderModels({
      provider: 'ninerouter',
      baseUrl: 'http://localhost:20128/v1'
    });
    assert.equal(list.length, 2);
    assert.equal(list[0].id, 'VibeCoding');
    assert.equal(list[1].id, 'groq/qwen/qwen3.8-27b');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('parseRobustJson handles trailing SSE tokens like data: [DONE] from 9Router', async () => {
  const { parseRobustJson } = await import('../src/services/ai/client.js');

  // Case 1: Standard clean JSON
  const cleanRes = {
    text: async () => '{"choices":[{"message":{"content":"pong"}}]}'
  };
  const cleanData = await parseRobustJson(cleanRes);
  assert.equal(cleanData.choices[0].message.content, 'pong');

  // Case 2: 9Router response with trailing data: [DONE]
  const sseTrailingRes = {
    text: async () => '{"choices":[{"message":{"content":"pong"}}]}\ndata: [DONE]'
  };
  const sseData = await parseRobustJson(sseTrailingRes);
  assert.equal(sseData.choices[0].message.content, 'pong');

  // Case 3: 9Router response with unexpected whitespace & trailing markers
  const messyRes = {
    text: async () => '{"id":"chatcmpl-123","choices":[{"message":{"content":"hello"}}]}\n\ndata: [DONE]\n'
  };
  const messyData = await parseRobustJson(messyRes);
  assert.equal(messyData.choices[0].message.content, 'hello');
});

test('completeChat falls back to reasoning content when content is null or array', async () => {
  const { completeChat } = await import('../src/services/ai/client.js');
  const originalFetch = globalThis.fetch;

  // Mock reasoning response (like VibeCoding / DeepSeek R1)
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          reasoning: 'Calculated pong response'
        }
      }]
    })
  });

  try {
    const res = await completeChat({
      messages: [{ role: 'user', content: 'Say pong' }],
      overrideConfig: {
        provider: 'ninerouter',
        baseUrl: 'http://localhost:20128/v1',
        model: 'VibeCoding'
      }
    });
    assert.equal(res.text, 'Calculated pong response');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
