import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node environment
const storageStore = new Map();
globalThis.localStorage = {
  getItem: (key) => storageStore.get(key) || null,
  setItem: (key, val) => storageStore.set(key, String(val)),
  removeItem: (key) => storageStore.delete(key),
  clear: () => storageStore.clear()
};

const { loadBYOKConfig, saveBYOKConfig, clearBYOKConfig } = await import('../src/modules/storage.js');
const { PROVIDER_PRESETS } = await import('../src/data/models.js');

test('PROVIDER_PRESETS contains openrouter, gemini, groq, openai, and custom', () => {
  assert.ok(PROVIDER_PRESETS.openrouter);
  assert.ok(PROVIDER_PRESETS.gemini);
  assert.ok(PROVIDER_PRESETS.groq);
  assert.ok(PROVIDER_PRESETS.openai);
  assert.ok(PROVIDER_PRESETS.custom);
  assert.equal(PROVIDER_PRESETS.openrouter.defaultModel, 'meta-llama/llama-3.3-70b-instruct:free');
});

test('loadBYOKConfig returns default openrouter preset when storage is empty', () => {
  storageStore.clear();
  const config = loadBYOKConfig();
  assert.equal(config.provider, 'openrouter');
  assert.equal(config.apiKey, '');
  assert.equal(config.model, 'meta-llama/llama-3.3-70b-instruct:free');
});

test('saveBYOKConfig and clearBYOKConfig manage pecut_byok_config properly', () => {
  storageStore.clear();
  saveBYOKConfig({
    provider: 'gemini',
    apiKey: 'AIzaSyTest123',
    model: 'gemini-1.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  });

  const loaded = loadBYOKConfig();
  assert.equal(loaded.provider, 'gemini');
  assert.equal(loaded.apiKey, 'AIzaSyTest123');

  clearBYOKConfig();
  assert.equal(loadBYOKConfig().apiKey, '');
});

test('loadBYOKConfig auto-migrates deprecated Gemini 2.5/3.5 models to gemini-3.8', () => {
  storageStore.clear();
  storageStore.set('pecut_byok_config', JSON.stringify({
    provider: 'gemini',
    apiKey: 'AIzaSyTest123',
    model: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  }));

  const loaded = loadBYOKConfig();
  assert.equal(loaded.model, 'gemini-3.8-flash', 'gemini-2.5-flash should auto-migrate to gemini-3.8-flash');

  // Test pro variant migration
  storageStore.set('pecut_byok_config', JSON.stringify({
    provider: 'gemini',
    apiKey: 'AIzaSyTest123',
    model: 'gemini-2.5-pro',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  }));
  const loadedPro = loadBYOKConfig();
  assert.equal(loadedPro.model, 'gemini-3.8-pro', 'gemini-2.5-pro should auto-migrate to gemini-3.8-pro');
});
