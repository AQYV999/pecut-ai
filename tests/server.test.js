import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPecutServer } from '../server/index.js';

let server;
let testPort;
let baseUrl;

before((_, done) => {
  server = createPecutServer();
  // Listen on ephemeral port 0 for testing
  server.listen(0, '127.0.0.1', () => {
    testPort = server.address().port;
    baseUrl = `http://127.0.0.1:${testPort}`;
    done();
  });
});

after((_, done) => {
  if (server) {
    server.close(done);
  } else {
    done();
  }
});

test('GET /api/ai/status returns status object with safe public metadata', async () => {
  const res = await fetch(`${baseUrl}/api/ai/status`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.ok('status' in data);
  assert.ok('provider' in data);
  assert.ok('model' in data);
  assert.ok('hasKey' in data);
  assert.equal(typeof data.hasKey, 'boolean');
  // Security test: Verify raw API key is NEVER leaked in response
  assert.equal('apiKey' in data, false);
  assert.equal('key' in data, false);
});

test('POST /api/ai/optimize rejects empty prompt with 400', async () => {
  const res = await fetch(`${baseUrl}/api/ai/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: '   ' })
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error);
});

test('POST /api/ai/optimize returns demo mode fallback when no key is in env', async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const res = await fetch(`${baseUrl}/api/ai/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Summarize quantum computing principles',
      goals: ['clarity']
    })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.mode, 'demo');
  assert.equal(data.hasKey, false);

  if (oldKey) process.env.GEMINI_API_KEY = oldKey;
});

test('POST /api/ai/flow/step rejects empty inputData with 400', async () => {
  const res = await fetch(`${baseUrl}/api/ai/flow/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputData: '' })
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error);
});

test('POST /api/ai/flow/step executes step successfully (demo fallback when key absent)', async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const res = await fetch(`${baseUrl}/api/ai/flow/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId: 'flow-content',
      stepIndex: 0,
      stepTitle: 'Hook Ideation',
      stepInstruction: 'Draft 3 viral hooks',
      inputData: 'AI developer tools in 2026',
      previousOutput: ''
    })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.stepIndex, 0);
  assert.equal(data.stepTitle, 'Hook Ideation');
  assert.ok(data.output && data.output.length > 0);

  if (oldKey) process.env.GEMINI_API_KEY = oldKey;
});
