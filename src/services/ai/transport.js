/**
 * Pecut AI — AI HTTP Transport, Payload Builder & Response Parser
 * Apache-2.0 License
 */

import { loadBYOKConfig } from '../../modules/storage.js';
import { PROVIDER_PRESETS } from '../../data/models.js';

/**
 * Checks if a given URL points to a local machine / loopback interface.
 * @param {string} urlString
 * @returns {boolean}
 */
export function isLocalOrigin(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch (_) {
    return false;
  }
}

/**
 * Safely parses JSON from a Response object, gracefully handling trailing SSE tokens
 * (e.g. 9Router appending `data: [DONE]` after completions).
 * @param {Response} res
 * @returns {Promise<any>}
 */
export async function parseRobustJson(res) {
  if (typeof res.text !== 'function' && typeof res.json === 'function') {
    return res.json();
  }
  const text = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json());
  try {
    return JSON.parse(text);
  } catch (initialErr) {
    // 1. Strip trailing SSE signals like "data: [DONE]"
    const stripped = text.replace(/\s*data:\s*\[DONE\]\s*$/i, '').trim();
    try {
      return JSON.parse(stripped);
    } catch (_) {}

    // 2. Extract first matching valid JSON block
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let startIdx = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    if (startIdx !== -1) {
      for (let endIdx = text.length; endIdx > startIdx; endIdx--) {
        const candidate = text.slice(startIdx, endIdx).trim();
        try {
          return JSON.parse(candidate);
        } catch (_) {}
      }
    }

    throw initialErr;
  }
}

/**
 * Builds a standardized OpenAI-compatible Chat Completion request payload.
 * @param {Object} options
 * @param {string} options.model
 * @param {Array<{ role: string, content: string }>} options.messages
 * @param {string} [options.systemPrompt]
 * @param {number} [options.temperature=0.3]
 * @param {number} [options.maxTokens=8192]
 * @returns {Object}
 */
export function buildChatPayload({ model, messages = [], systemPrompt, temperature = 0.3, maxTokens = 8192 }) {
  const formattedMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    formattedMessages.push({ role: 'system', content: systemPrompt.trim() });
  }

  messages.forEach(m => {
    if (m && m.role && m.content) {
      formattedMessages.push({ role: m.role, content: m.content });
    }
  });

  return {
    model: model || 'meta-llama/llama-3.3-70b-instruct:free',
    messages: formattedMessages,
    temperature,
    max_tokens: maxTokens
  };
}

/**
 * Executes a Chat Completion request through the appropriate transport.
 * @param {Object} options
 * @param {string} [options.systemPrompt]
 * @param {Array<{ role: string, content: string }>} options.messages
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @param {Object} [options.overrideConfig]
 * @returns {Promise<{ text: string, reasoning: string, raw: Object, provider: string, model: string, finishReason: string, truncated: boolean, isReasoningOnly: boolean }>}
 */
export async function completeChat(options = {}) {
  const config = options.overrideConfig || loadBYOKConfig();
  const apiKey = (config.apiKey || '').trim();
  const provider = config.provider || 'openrouter';
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openrouter;
  const model = config.model || preset.defaultModel;
  let baseUrl = (config.baseUrl || preset.baseUrl).replace(/\/+$/, '');
  if (provider === 'gemini' && baseUrl.includes('generativelanguage.googleapis.com') && !baseUrl.includes('/openai')) {
    baseUrl = `${baseUrl}/openai`;
  }

  const targetUrl = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  const payload = buildChatPayload({
    model,
    messages: options.messages || [],
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens
  });

  const authHeader = apiKey ? (apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`) : 'Bearer none';

  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const isLocal = isLocalOrigin(targetUrl);

      // Mixed Content detection: HTTPS websites cannot fetch plain HTTP loopback endpoints
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && isLocal && targetUrl.startsWith('http:')) {
        throw new Error(
          'Browser Security (Mixed Content): Web HTTPS tidak dapat menghubungi http://localhost secara langsung. ' +
          'Solusi: (1) Aktifkan "Tunnel" di dasbor 9Router untuk mendapatkan URL HTTPS publik, atau ' +
          '(2) Jalankan Pecut AI secara lokal via npm run dev (http://localhost:5173).'
        );
      }

      let res;
      if (isLocal) {
        // Direct local dispatch (e.g. Ollama / LMStudio / local 9Router on HTTP)
        res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(payload)
        });
      } else if (provider === 'ninerouter' || provider === 'custom') {
        // For custom or 9Router HTTPS endpoints (such as Cloudflare Tunnel):
        // Try direct browser fetch first (CORS allowed by 9Router), fallback to proxy
        try {
          res = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify(payload)
          });
        } catch (_) {
          res = await fetch('/api/ai/proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
              'x-target-url': targetUrl
            },
            body: JSON.stringify(payload)
          });
        }
      } else {
        // Cloud dispatch via universal proxy
        res = await fetch('/api/ai/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'x-target-url': targetUrl
          },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const rawData = await parseRobustJson(res).catch(() => ({}));
        const errObj = Array.isArray(rawData) ? rawData[0] : rawData;
        const msg = errObj?.error?.message
          || errObj?.error
          || (typeof errObj === 'string' ? errObj : `HTTP ${res.status}: ${res.statusText}`);

        // If provider rejects high max_tokens (HTTP 400), step down gracefully and retry
        if (res.status === 400 && msg.toLowerCase().includes('max_tokens') && payload.max_tokens > 4096 && attempt < maxRetries) {
          payload.max_tokens = 4096;
          continue;
        }

        // If Google or another provider returns 503 or "high demand", auto-retry after backoff
        const isHighDemand = res.status === 503 || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('temporarily unavailable');
        if (isHighDemand && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }

        throw new Error(msg);
      }

      const data = await parseRobustJson(res);
      const choice = data.choices?.[0];
      const message = choice?.message;
      const finishReason = choice?.finish_reason || choice?.native_finish_reason || '';

      let content = message?.content;
      if (Array.isArray(content)) {
        content = content.map(part => part?.text || part?.content || (typeof part === 'string' ? part : '')).join('');
      }

      let reasoning = (message?.reasoning || message?.reasoning_content || '').trim();

      // Extract inline <think>...</think> blocks (or unclosed <think>... when truncated)
      if (typeof content === 'string' && content.includes('<think>')) {
        const thinkBlocks = [];
        let cleaned = content.replace(/<think>([\s\S]*?)<\/think>/gi, (_, inner) => {
          if (inner && inner.trim()) thinkBlocks.push(inner.trim());
          return '';
        });
        // Handle unclosed <think> if model hit token limit mid-thought
        const unclosedIdx = cleaned.search(/<think>/i);
        if (unclosedIdx !== -1) {
          const tail = cleaned.slice(unclosedIdx).replace(/^<think>/i, '').trim();
          if (tail) thinkBlocks.push(tail);
          cleaned = cleaned.slice(0, unclosedIdx);
        }
        if (thinkBlocks.length > 0) {
          reasoning = [reasoning, ...thinkBlocks].filter(Boolean).join('\n\n');
        }
        content = cleaned.trim();
      }

      const hasDirectContent = typeof content === 'string' && content.trim().length > 0;
      let isReasoningOnly = false;

      // Fallback to reasoning / thinking tokens if content is empty or null (e.g. DeepSeek-R1 / Nemotron / VibeCoding)
      if (!hasDirectContent && reasoning) {
        content = reasoning;
        isReasoningOnly = true;
      }

      // Fallback to legacy completion text
      if (!content && choice?.text) {
        content = choice.text;
      }

      if (!content && typeof content !== 'string') {
        throw new Error('AI provider returned an empty completion.');
      }

      return {
        text: content,
        reasoning,
        raw: data,
        provider,
        model,
        finishReason,
        truncated: finishReason === 'length',
        isReasoningOnly
      };
    } catch (err) {
      if (err.message && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && isLocalOrigin(targetUrl)) {
          throw new Error(
            'Browser Security (Mixed Content): Web HTTPS memblokir HTTP localhost. ' +
            'Solusi: Aktifkan "Tunnel" di dasbor 9Router (URL HTTPS) atau jalankan Pecut AI secara lokal via npm run dev di http://localhost:5173.'
          );
        }
        if (isLocalOrigin(targetUrl)) {
          throw new Error(
            `Koneksi gagal ke ${targetUrl}. Pastikan 9Router / server lokal sedang aktif di komputer Anda.`
          );
        }
      }

      lastError = err;
      if (attempt >= maxRetries) throw err;
      if (err.message && (err.message.toLowerCase().includes('high demand') || err.message.toLowerCase().includes('503'))) {
        await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('AI request failed after retries.');
}
