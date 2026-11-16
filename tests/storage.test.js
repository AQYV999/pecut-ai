import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node environment
const storageStore = new Map();
globalThis.localStorage = {
  getItem: (key) => storageStore.get(key) || null,
  setItem: (key, val) => storageStore.set(key, String(val)),
  removeItem: (key) => storageStore.delete(key),
  clear: () => storageStore.clear()
};

// Import after setting up mock
const { loadSettings } = await import('../src/modules/storage.js');

test('loadSettings strips insecure legacy apiKey and provider from localStorage', () => {
  storageStore.set(
    'pecut_settings',
    JSON.stringify({
      theme: 'dark',
      language: 'en',
      apiKey: 'sk-insecure-test-key-should-be-stripped',
      provider: 'openai'
    })
  );

  const settings = loadSettings();
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.language, 'en');
  assert.equal('apiKey' in settings, false, 'apiKey must not be in loaded settings');
  assert.equal('provider' in settings, false, 'provider must not be in loaded settings');

  // Verify storage was sanitized
  const persisted = JSON.parse(storageStore.get('pecut_settings'));
  assert.equal('apiKey' in persisted, false, 'persisted storage must not contain apiKey');
  assert.equal('provider' in persisted, false, 'persisted storage must not contain provider');
});
