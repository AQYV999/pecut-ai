/**
 * Pecut AI — Local State & Storage Management
 * Apache-2.0 License
 */

import { DEFAULT_PROFILES } from '../data/profiles.js';
import { PROVIDER_PRESETS } from '../data/models.js';

const BYOK_CONFIG_KEY = 'pecut_byok_config';
const BYOK_PROFILES_KEY = 'pecut_byok_profiles';

function normalizeProviderEntry(providerId, rawEntry = {}) {
  const provider = providerId || rawEntry.provider || 'openrouter';
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openrouter;
  let model = rawEntry.model || preset.defaultModel;

  // Auto-migrate known deprecated Gemini models to gemini-3.8-flash, while preserving other valid Gemini models
  const DEPRECATED_GEMINI_MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-pro',
    'gemini-1.0-pro'
  ];
  if (provider === 'gemini' && DEPRECATED_GEMINI_MODELS.includes(model)) {
    model = 'gemini-3.8-flash';
  }

  return {
    provider,
    apiKey: (rawEntry.apiKey || '').trim(),
    model,
    baseUrl: (rawEntry.baseUrl || preset.baseUrl).trim()
  };
}

/**
 * Loads the per-provider BYOK profiles map from localStorage.
 * Automatically migrates any existing active `pecut_byok_config` into its provider slot.
 * @returns {Record<string, { provider: string, apiKey: string, model: string, baseUrl: string }>}
 */
export function loadProviderProfiles() {
  let profiles = {};
  try {
    const raw = localStorage.getItem(BYOK_PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        profiles = parsed;
      }
    }
  } catch (_) {
    profiles = {};
  }

  // Seamless migration: if user already has a saved active config not yet in profiles map
  try {
    const rawActive = localStorage.getItem(BYOK_CONFIG_KEY);
    if (rawActive) {
      const active = JSON.parse(rawActive);
      if (active && active.provider && !profiles[active.provider]) {
        profiles[active.provider] = normalizeProviderEntry(active.provider, active);
        localStorage.setItem(BYOK_PROFILES_KEY, JSON.stringify(profiles));
      }
    }
  } catch (_) {}

  return profiles;
}

/**
 * Returns the isolated saved profile for a specific AI provider, or a clean default with empty key.
 * @param {string} providerId
 * @returns {{ provider: string, apiKey: string, model: string, baseUrl: string }}
 */
export function getProviderProfile(providerId) {
  const provider = providerId || 'openrouter';
  const profiles = loadProviderProfiles();
  if (profiles[provider]) {
    return normalizeProviderEntry(provider, profiles[provider]);
  }
  return normalizeProviderEntry(provider, {});
}

/**
 * Saves credentials & endpoint strictly for a specific AI provider without affecting other providers.
 * @param {Object} config
 */
export function saveProviderProfile(config) {
  if (!config || typeof config !== 'object') return;
  const provider = config.provider || 'openrouter';
  const normalized = {
    ...normalizeProviderEntry(provider, config),
    updatedAt: new Date().toISOString()
  };
  const profiles = loadProviderProfiles();
  profiles[provider] = normalized;
  localStorage.setItem(BYOK_PROFILES_KEY, JSON.stringify(profiles));
  return normalized;
}

/**
 * Clears ONLY the specified provider's saved profile, preserving all other providers' keys.
 * @param {string} providerId
 */
export function clearProviderProfile(providerId) {
  if (!providerId) return;
  const profiles = loadProviderProfiles();
  delete profiles[providerId];
  localStorage.setItem(BYOK_PROFILES_KEY, JSON.stringify(profiles));

  const active = loadBYOKConfig();
  if (active.provider === providerId) {
    const preset = PROVIDER_PRESETS[providerId] || PROVIDER_PRESETS.openrouter;
    const clearedActive = {
      provider: providerId,
      apiKey: '',
      model: preset.defaultModel,
      baseUrl: preset.baseUrl,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(BYOK_CONFIG_KEY, JSON.stringify(clearedActive));
    appState.byok = clearedActive;
  }
}

// BYOK (Bring Your Own Key) Storage Configuration
export function loadBYOKConfig() {
  try {
    const raw = localStorage.getItem(BYOK_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeProviderEntry(parsed.provider || 'openrouter', parsed);
    }
  } catch (_) {
    // fallback to default
  }

  return normalizeProviderEntry('openrouter', {});
}

export function saveBYOKConfig(config) {
  if (!config || typeof config !== 'object') return;
  const saved = saveProviderProfile(config);
  localStorage.setItem(BYOK_CONFIG_KEY, JSON.stringify(saved));
  appState.byok = saved;
}

export function clearBYOKConfig(providerId = null) {
  if (providerId) {
    clearProviderProfile(providerId);
    return;
  }
  localStorage.removeItem(BYOK_CONFIG_KEY);
  localStorage.removeItem(BYOK_PROFILES_KEY);
  appState.byok = loadBYOKConfig();
}

// SECURITY: legacy `apiKey` and `provider` are stripped from persisted settings.
// Secrets must never live in the browser's localStorage.
export function loadSettings() {
  let parsed = {};
  try {
    parsed = JSON.parse(localStorage.getItem('pecut_settings') || '{}');
  } catch (_) {
    parsed = {};
  }
  if (parsed && ('apiKey' in parsed || 'provider' in parsed)) {
    delete parsed.apiKey;
    delete parsed.provider;
    localStorage.setItem('pecut_settings', JSON.stringify(parsed));
  }
  return {
    theme: parsed.theme || 'dark',
    language: parsed.language || 'id',
    tone: parsed.tone || 'Professional & Authoritative',
    format: parsed.format || 'Markdown Report'
  };
}

export function loadSavedPrompts() {
  try {
    return JSON.parse(localStorage.getItem('pecut_saved_prompts') || '[]');
  } catch (_) {
    return [];
  }
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('pecut_history') || '[]');
  } catch (_) {
    return [];
  }
}

export function loadProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem('pecut_context_profiles') || 'null');
    if (Array.isArray(saved) && saved.length > 0) return saved;
    return [...DEFAULT_PROFILES];
  } catch (_) {
    return [...DEFAULT_PROFILES];
  }
}

export const appState = {
  savedPrompts: loadSavedPrompts(),
  history: loadHistory(),
  settings: loadSettings(),
  profiles: loadProfiles(),
  byok: loadBYOKConfig()
};

export function applyTheme(theme) {
  const resolvedTheme = theme || appState.settings.theme || 'dark';
  document.documentElement.setAttribute('data-theme', resolvedTheme);
}

export function saveState() {
  localStorage.setItem('pecut_saved_prompts', JSON.stringify(appState.savedPrompts));
  localStorage.setItem('pecut_history', JSON.stringify(appState.history));
  localStorage.setItem('pecut_settings', JSON.stringify(appState.settings));
  localStorage.setItem('pecut_context_profiles', JSON.stringify(appState.profiles));
  updateGlobalCounters();
}

export function updateGlobalCounters() {
  const savedCount = appState.savedPrompts.length;
  const histCount = appState.history.length;
  const favCount = appState.savedPrompts.filter(p => p.isFavorite).length;
  const profileCount = appState.profiles.length;

  const libBadge = document.getElementById('libCountBadge');
  if (libBadge) libBadge.textContent = savedCount;
  const statSaved = document.getElementById('statSavedCount');
  if (statSaved) statSaved.textContent = savedCount;
  const statHist = document.getElementById('statHistoryCount');
  if (statHist) statHist.textContent = histCount;
  const metricSaved = document.getElementById('metricSaved');
  if (metricSaved) metricSaved.textContent = savedCount;
  const metricExec = document.getElementById('metricExecutions');
  if (metricExec) metricExec.textContent = histCount;
  const metricFav = document.getElementById('metricFavorites');
  if (metricFav) metricFav.textContent = favCount;
  const profBadge = document.getElementById('profilesCountBadge');
  if (profBadge) profBadge.textContent = profileCount;
}
