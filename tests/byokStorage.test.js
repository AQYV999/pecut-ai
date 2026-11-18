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

const {
  loadBYOKConfig,
  saveBYOKConfig,
  clearBYOKConfig,
  getProviderProfile,
  loadProviderProfiles
} = await import('../src/modules/storage.js');
const { PROVIDER_PRESETS } = await import('../src/data/models.js');

test('PROVIDER_PRESETS contains openrouter, gemini, groq, openai, ninerouter, and custom', () => {
  assert.ok(PROVIDER_PRESETS.openrouter);
  assert.ok(PROVIDER_PRESETS.gemini);
  assert.ok(PROVIDER_PRESETS.groq);
  assert.ok(PROVIDER_PRESETS.openai);
  assert.ok(PROVIDER_PRESETS.ninerouter);
  assert.ok(PROVIDER_PRESETS.custom);
  assert.equal(PROVIDER_PRESETS.openrouter.defaultModel, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(PROVIDER_PRESETS.ninerouter.defaultModel, 'VibeCoding');
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

test('loadBYOKConfig auto-migrates deprecated Gemini models to gemini-3.8-flash', () => {
  storageStore.clear();
  storageStore.set('pecut_byok_config', JSON.stringify({
    provider: 'gemini',
    apiKey: 'AIzaSyTest123',
    model: 'gemini-1.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  }));

  const loaded = loadBYOKConfig();
  assert.equal(loaded.model, 'gemini-3.8-flash', 'gemini-1.5-flash should auto-migrate to gemini-3.8-flash');

  // Test other deprecated variants
  storageStore.set('pecut_byok_config', JSON.stringify({
    provider: 'gemini',
    apiKey: 'AIzaSyTest123',
    model: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  }));
  const loaded2 = loadBYOKConfig();
  assert.equal(loaded2.model, 'gemini-3.8-flash', 'gemini-2.0-flash should auto-migrate to gemini-3.8-flash');
});

test('per-provider BYOK profiles isolate API keys, baseUrls, and models cleanly', () => {
  storageStore.clear();

  // Save 9Router profile with custom tunnel URL and key
  saveBYOKConfig({
    provider: 'ninerouter',
    apiKey: 'sk-9router-secret',
    baseUrl: 'https://rb5ems4.abc-tunnel.us/v1',
    model: 'VibeCoding'
  });

  // Switch and save OpenRouter profile with its own key
  saveBYOKConfig({
    provider: 'openrouter',
    apiKey: 'sk-or-v1-secret',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'ernie-5.5-flash-preview'
  });

  // Active config is OpenRouter
  const active = loadBYOKConfig();
  assert.equal(active.provider, 'openrouter');
  assert.equal(active.apiKey, 'sk-or-v1-secret');

  // 9Router profile is completely preserved!
  const nrProfile = getProviderProfile('ninerouter');
  assert.equal(nrProfile.apiKey, 'sk-9router-secret');
  assert.equal(nrProfile.baseUrl, 'https://rb5ems4.abc-tunnel.us/v1');
  assert.equal(nrProfile.model, 'VibeCoding');

  // Unconfigured provider (groq) has empty API key — zero leakage!
  const groqProfile = getProviderProfile('groq');
  assert.equal(groqProfile.apiKey, '');
  assert.equal(groqProfile.baseUrl, PROVIDER_PRESETS.groq.baseUrl);
  assert.equal(groqProfile.model, PROVIDER_PRESETS.groq.defaultModel);

  // Clearing ONLY openrouter leaves 9Router untouched
  clearBYOKConfig('openrouter');
  assert.equal(getProviderProfile('openrouter').apiKey, '');
  assert.equal(getProviderProfile('ninerouter').apiKey, 'sk-9router-secret');
  assert.equal(getProviderProfile('ninerouter').baseUrl, 'https://rb5ems4.abc-tunnel.us/v1');
  assert.ok(loadProviderProfiles().ninerouter);
});
