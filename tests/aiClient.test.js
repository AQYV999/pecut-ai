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
    assert.equal(res.isReasoningOnly, true);
    assert.equal(res.reasoning, 'Calculated pong response');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('completeChat extracts inline <think> blocks into reasoning and flags finish_reason length', async () => {
  const { completeChat } = await import('../src/services/ai/client.js');
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      choices: [{
        finish_reason: 'length',
        message: {
          role: 'assistant',
          content: '<think>Planning HTML grid layout</think>\n<h1>Hello</h1>'
        }
      }]
    })
  });

  try {
    const res = await completeChat({
      messages: [{ role: 'user', content: 'Build page' }],
      overrideConfig: {
        provider: 'ninerouter',
        baseUrl: 'http://localhost:20128/v1',
        model: 'VibeCoding'
      }
    });
    assert.equal(res.reasoning, 'Planning HTML grid layout');
    assert.equal(res.text, '<h1>Hello</h1>');
    assert.equal(res.truncated, true);
    assert.equal(res.isReasoningOnly, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('streamChat receives and processes progressive SSE chunks and extracts reasoning', async () => {
  const { streamChat } = await import('../src/services/ai/client.js');
  const originalFetch = globalThis.fetch;

  const encoder = new TextEncoder();
  const mockChunks = [
    'data: {"choices":[{"delta":{"role":"assistant","reasoning_content":"Analyzing design system"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"<!DOCTYPE "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"html>\\n<h1>Pecut AI Live</h1>"}}]}\n\n',
    'data: [DONE]\n\n'
  ];

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get: (header) => (header.toLowerCase() === 'content-type' ? 'text/event-stream; charset=utf-8' : null)
    },
    body: new ReadableStream({
      start(controller) {
        for (const c of mockChunks) {
          controller.enqueue(encoder.encode(c));
        }
        controller.close();
      }
    })
  });

  const streamedDeltas = [];
  try {
    const res = await streamChat({
      messages: [{ role: 'user', content: 'Generate page' }],
      overrideConfig: {
        provider: 'ninerouter',
        baseUrl: 'http://localhost:20128/v1',
        model: 'VibeCoding'
      }
    }, (chunk) => {
      streamedDeltas.push(chunk);
    });

    assert.ok(streamedDeltas.length >= 2, 'Must receive multiple progressive chunks');
    assert.equal(res.reasoning, 'Analyzing design system');
    assert.equal(res.text, '<!DOCTYPE html>\n<h1>Pecut AI Live</h1>');
    assert.equal(res.isReasoningOnly, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('streamChat parses inline <think> tags split across stream chunks cleanly', async () => {
  const { streamChat } = await import('../src/services/ai/client.js');
  const originalFetch = globalThis.fetch;

  const encoder = new TextEncoder();
  const mockChunks = [
    'data: {"choices":[{"delta":{"content":"<think>Step 1: Check requirements"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" and build nav</think><div>Navbar</div>"}}]}\n\n',
    'data: [DONE]\n\n'
  ];

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get: (header) => (header.toLowerCase() === 'content-type' ? 'text/event-stream' : null)
    },
    body: new ReadableStream({
      start(controller) {
        for (const c of mockChunks) {
          controller.enqueue(encoder.encode(c));
        }
        controller.close();
      }
    })
  });

  try {
    const res = await streamChat({
      messages: [{ role: 'user', content: 'Design navbar' }],
      overrideConfig: {
        provider: 'openrouter',
        apiKey: 'sk-test',
        model: 'ernie-5.5-flash-preview'
      }
    });

    assert.equal(res.reasoning, 'Step 1: Check requirements and build nav');
    assert.equal(res.text, '<div>Navbar</div>');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('completeChat delegates to streamChat when onChunk callback is provided', async () => {
  const { completeChat } = await import('../src/services/ai/client.js');
  const originalFetch = globalThis.fetch;

  const encoder = new TextEncoder();
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get: (header) => (header.toLowerCase() === 'content-type' ? 'text/event-stream' : null)
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Continuous streaming"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    })
  });

  let calledWithChunk = false;
  try {
    const res = await completeChat({
      messages: [{ role: 'user', content: 'Stream test' }],
      overrideConfig: {
        provider: 'openrouter',
        apiKey: 'sk-test',
        model: 'ernie-5.5-flash-preview'
      },
      onChunk: (chunk) => {
        calledWithChunk = true;
      }
    });

    assert.equal(calledWithChunk, true);
    assert.equal(res.text, 'Continuous streaming');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('streamChat extracts <!DOCTYPE html> code starting inside unclosed <think> tag into text', async () => {
  const { streamChat } = await import('../src/services/ai/client.js');
  const originalFetch = globalThis.fetch;

  const encoder = new TextEncoder();
  // Simulates a reasoning model that emits <think>, thinks at length, and directly emits <!DOCTYPE html> without </think>
  const mockChunks = [
    'data: {"choices":[{"delta":{"content":"<think>The user wants a portfolio page without AI slop. I should structure hero and projects."}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"<!DOCTYPE html><html><head><title>Portfolio</title></head><body><h1>Dev Portfolio</h1></body></html>"}}]}\n\n',
    'data: [DONE]\n\n'
  ];

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get: (header) => (header.toLowerCase() === 'content-type' ? 'text/event-stream' : null)
    },
    body: new ReadableStream({
      start(controller) {
        for (const c of mockChunks) {
          controller.enqueue(encoder.encode(c));
        }
        controller.close();
      }
    })
  });

  try {
    const res = await streamChat({
      messages: [{ role: 'user', content: 'Create portfolio' }],
      overrideConfig: {
        provider: 'openrouter',
        apiKey: 'sk-test',
        model: 'ernie-5.5-flash-preview'
      }
    });

    assert.ok(res.reasoning.includes('The user wants a portfolio page'), 'Reasoning part should be stashed');
    assert.ok(res.text.includes('<!DOCTYPE html><html>'), 'HTML code must be extracted into text');
    assert.equal(res.isReasoningOnly, false, 'Should NOT be flagged as reasoning-only when code exists');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('buildCleanHistoryPayload includes assistant messages with reasoning so user turns are not stacked', async () => {
  const { buildCleanHistoryPayload } = await import('../src/modules/chat/storage.js');

  const messages = [
    { id: '1', role: 'user', content: 'Buat web' },
    { id: '2', role: 'assistant', content: '', reasoning: 'Thinking about layout...' },
    { id: '3', role: 'user', content: 'Lanjutkan kodenya' }
  ];

  const payload = buildCleanHistoryPayload(messages);

  assert.equal(payload.length, 3, 'Must retain all 3 messages without dropping assistant message');
  assert.equal(payload[0].role, 'user');
  assert.equal(payload[1].role, 'assistant');
  assert.equal(payload[1].content, 'Thinking about layout...');
  assert.equal(payload[2].role, 'user');
});
