/**
 * Pecut AI — Provider Discovery, Connection Probe & Active Status
 * Apache-2.0 License
 */

import { loadBYOKConfig } from '../../modules/storage.js';
import { PROVIDER_PRESETS } from '../../data/models.js';
import { isLocalOrigin, parseRobustJson, completeChat } from './transport.js';

/**
 * Fetches available models dynamically from the provider using the user's API key.
 * @param {Object} config
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function fetchProviderModels(config) {
  const provider = config.provider || 'openrouter';
  const apiKey = (config.apiKey || '').trim();
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openrouter;
  const baseUrl = (config.baseUrl || preset.baseUrl).replace(/\/+$/, '');

  let modelsUrl = '';
  const headers = {};

  if (provider === 'gemini') {
    modelsUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    if (apiKey) {
      headers['x-goog-api-key'] = apiKey;
    }
  } else if (provider === 'openrouter') {
    modelsUrl = 'https://openrouter.ai/api/v1/models';
    if (apiKey) headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
  } else if (provider === 'groq') {
    modelsUrl = 'https://api.groq.com/openai/v1/models';
    if (apiKey) headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
  } else if (provider === 'openai') {
    modelsUrl = 'https://api.openai.com/v1/models';
    if (apiKey) headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
  } else {
    modelsUrl = `${baseUrl.replace(/\/chat\/completions$/, '')}/models`;
    if (apiKey) headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
  }

  const isLocal = isLocalOrigin(modelsUrl);
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && isLocal && modelsUrl.startsWith('http:')) {
    throw new Error(
      'Browser Security (Mixed Content): Web HTTPS memblokir akses ke http://localhost. ' +
      'Silakan aktifkan "Tunnel" di dasbor 9Router (URL HTTPS) atau jalankan Pecut AI di http://localhost:5173 (npm run dev).'
    );
  }

  let res;
  if (isLocal) {
    try {
      res = await fetch(modelsUrl, { headers });
    } catch (_) {
      throw new Error(`Koneksi gagal ke ${modelsUrl}. Pastikan server lokal (9Router/Ollama) sedang berjalan.`);
    }
  } else if (provider === 'ninerouter' || provider === 'custom') {
    try {
      res = await fetch(modelsUrl, { headers });
    } catch (_) {
      res = await fetch('/api/ai/proxy', {
        headers: {
          ...headers,
          'x-target-url': modelsUrl
        }
      });
    }
  } else {
    res = await fetch('/api/ai/proxy', {
      headers: {
        ...headers,
        'x-target-url': modelsUrl
      }
    });
  }

  if (!res.ok) {
    const rawData = await parseRobustJson(res).catch(() => ({}));
    const errObj = Array.isArray(rawData) ? rawData[0] : rawData;
    throw new Error(errObj?.error?.message || errObj?.error || `HTTP ${res.status}: Failed to fetch models`);
  }

  const data = await parseRobustJson(res);
  const rawList = data.data || data.models || [];
  return rawList
    .filter(m => {
      if (m.supportedGenerationMethods && Array.isArray(m.supportedGenerationMethods)) {
        return m.supportedGenerationMethods.includes('generateContent');
      }
      return true;
    })
    .map(m => {
      const id = m.id || m.name?.replace(/^models\//, '');
      return {
        id,
        name: m.displayName || m.name || m.id
      };
    })
    .filter(m => Boolean(m.id));
}

/**
 * Tests connection with a given provider configuration using a minimal 1-token probe.
 * @param {Object} config
 * @returns {Promise<{ success: boolean, message: string, latencyMs: number }>}
 */
export async function testAIConnection(config) {
  const startTime = Date.now();
  try {
    const res = await completeChat({
      messages: [{ role: 'user', content: 'Say "pong"' }],
      maxTokens: 100,
      overrideConfig: config
    });
    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: `Connected successfully to ${config.provider} (${res.model}) in ${latencyMs}ms. Response: "${res.text.trim()}"`,
      latencyMs
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      message: err.message || 'Connection failed',
      latencyMs
    };
  }
}

/**
 * Returns summary of current active provider for UI status indicators.
 * @returns {Object}
 */
export function getActiveProviderInfo() {
  const config = loadBYOKConfig();
  const preset = PROVIDER_PRESETS[config.provider] || PROVIDER_PRESETS.openrouter;
  const isKeylessProvider = config.provider === 'custom' || config.provider === 'ninerouter';
  const hasKey = Boolean(config.apiKey && config.apiKey.trim()) || isKeylessProvider;
  return {
    provider: config.provider,
    name: preset.name,
    model: config.model || preset.defaultModel,
    hasKey,
    isLocal: isLocalOrigin(config.baseUrl || preset.baseUrl)
  };
}
