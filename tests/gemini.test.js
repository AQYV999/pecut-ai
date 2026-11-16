import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callGeminiOptimizer } from '../server/providers/gemini.js';

test('callGeminiOptimizer throws descriptive error when apiKey is missing', async () => {
  await assert.rejects(
    async () => {
      await callGeminiOptimizer({
        apiKey: '',
        prompt: 'test prompt'
      });
    },
    {
      message: /GEMINI_API_KEY is not configured/
    }
  );
});
