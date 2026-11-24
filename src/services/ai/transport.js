/**
 * Pecut AI — AI HTTP Transport, Payload Builder & Response Parser
 * Apache-2.0 License
 */

import { loadBYOKConfig } from '../../modules/storage.js';
import { PROVIDER_PRESETS } from '../../data/models.js';

/**
 * Sleep helper that wakes up and rejects immediately if AbortSignal is triggered.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
export function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      return reject(new DOMException('The user aborted a request.', 'AbortError'));
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('The user aborted a request.', 'AbortError'));
      }, { once: true });
    }
  });
}

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

    // 2. Extract first matching valid JSON block with bounded bracket search (prevents O(N²) freeze)
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
      const lastBrace = text.lastIndexOf('}');
      const lastBracket = text.lastIndexOf(']');
      let endCandidate = Math.max(lastBrace, lastBracket);
      let attempts = 0;
      while (endCandidate > startIdx && attempts < 10) {
        const candidate = text.slice(startIdx, endCandidate + 1).trim();
        try {
          return JSON.parse(candidate);
        } catch (_) {}
        const prevBrace = text.lastIndexOf('}', endCandidate - 1);
        const prevBracket = text.lastIndexOf(']', endCandidate - 1);
        endCandidate = Math.max(prevBrace, prevBracket);
        attempts++;
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
 * @param {boolean} [options.stream=false]
 * @returns {Object}
 */
export function buildChatPayload({ model, messages = [], systemPrompt, temperature = 0.3, maxTokens = 8192, stream = false }) {
  const formattedMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    formattedMessages.push({ role: 'system', content: systemPrompt.trim() });
  }

  messages.forEach(m => {
    if (m && m.role && m.content) {
      formattedMessages.push({ role: m.role, content: m.content });
    }
  });

  const payload = {
    model: model || 'meta-llama/llama-3.3-70b-instruct:free',
    messages: formattedMessages,
    temperature,
    max_tokens: maxTokens
  };

  if (stream) {
    payload.stream = true;
  }

  return payload;
}

/**
 * Executes a Chat Completion request through the appropriate transport.
 * @param {Object} options
 * @param {string} [options.systemPrompt]
 * @param {Array<{ role: string, content: string }>} options.messages
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @param {Object} [options.overrideConfig]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ text: string, reasoning: string, raw: Object, provider: string, model: string, finishReason: string, truncated: boolean, isReasoningOnly: boolean, usage: { promptTokens: number, completionTokens: number, totalTokens: number } }>}
 */
export async function completeChat(options = {}) {
  if (typeof options.onChunk === 'function') {
    return streamChat(options, options.onChunk);
  }
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
    // Immediate early abort check
    if (options.signal && options.signal.aborted) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }

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

      const fetchOpts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(payload)
      };
      if (options.signal) {
        fetchOpts.signal = options.signal;
      }

      let res;
      if (isLocal) {
        // Direct local dispatch (e.g. Ollama / LMStudio / local 9Router on HTTP)
        res = await fetch(targetUrl, fetchOpts);
      } else if (provider === 'ninerouter' || provider === 'custom') {
        // For custom or 9Router HTTPS endpoints (such as Cloudflare Tunnel):
        // Try direct browser fetch first (CORS allowed by 9Router), fallback to proxy
        try {
          res = await fetch(targetUrl, fetchOpts);
        } catch (_) {
          const proxyOpts = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
              'x-target-url': targetUrl
            },
            body: JSON.stringify(payload)
          };
          if (options.signal) proxyOpts.signal = options.signal;
          res = await fetch('/api/ai/proxy', proxyOpts);
        }
      } else {
        // Cloud dispatch via universal proxy
        const proxyOpts = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'x-target-url': targetUrl
          },
          body: JSON.stringify(payload)
        };
        if (options.signal) proxyOpts.signal = options.signal;
        res = await fetch('/api/ai/proxy', proxyOpts);
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

        // If provider returns HTTP 429 (Rate Limit), handle Retry-After header or exponential backoff
        if (res.status === 429 && attempt < maxRetries) {
          const retryHeader = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
          let delayMs = 1500 * Math.pow(2, attempt);
          if (retryHeader) {
            const parsedSeconds = parseInt(retryHeader, 10);
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              delayMs = Math.min(parsedSeconds * 1000, 10000);
            }
          }
          await abortableSleep(delayMs, options.signal);
          continue;
        }

        // If Google or another provider returns 503 or "high demand", auto-retry after backoff
        const isHighDemand = res.status === 503 || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('temporarily unavailable');
        if (isHighDemand && attempt < maxRetries) {
          await abortableSleep(1500 * (attempt + 1), options.signal);
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

      // Check if reasoning contains unclosed code (e.g. model output <!DOCTYPE or ``` without closing </think>)
      if (reasoning) {
        const codeStart = reasoning.search(/(<!DOCTYPE|<html|```html|```[a-z]*\n)/i);
        if (codeStart !== -1) {
          const thoughtPart = reasoning.slice(0, codeStart).trim();
          const codePart = reasoning.slice(codeStart).trim();
          reasoning = thoughtPart;
          content = content ? `${content}\n${codePart}` : codePart;
        }
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

      // Normalized token usage telemetry
      const rawUsage = data.usage || {};
      const usage = {
        promptTokens: Number(rawUsage.prompt_tokens || rawUsage.promptTokens || 0),
        completionTokens: Number(rawUsage.completion_tokens || rawUsage.completionTokens || 0),
        totalTokens: Number(rawUsage.total_tokens || rawUsage.totalTokens || 0)
      };

      return {
        text: content,
        reasoning,
        raw: data,
        provider,
        model,
        finishReason,
        truncated: finishReason === 'length',
        isReasoningOnly,
        usage
      };
    } catch (err) {
      // If request was aborted by user/caller, do not retry and propagate immediately
      if (err.name === 'AbortError' || (options.signal && options.signal.aborted)) {
        throw err;
      }

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
        await abortableSleep(1500 * (attempt + 1), options.signal);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('AI request failed after retries.');
}

/**
 * Streams a Chat Completion request progressively via Server-Sent Events (SSE).
 * Invokes onChunk callback in real time for progressive typing rendering.
 *
 * @param {Object} options
 * @param {string} [options.systemPrompt]
 * @param {Array<{ role: string, content: string }>} options.messages
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @param {Object} [options.overrideConfig]
 * @param {AbortSignal} [options.signal]
 * @param {Function} [onChunk]
 * @returns {Promise<{ text: string, reasoning: string, raw: Object, provider: string, model: string, finishReason: string, truncated: boolean, isReasoningOnly: boolean, usage: { promptTokens: number, completionTokens: number, totalTokens: number } }>}
 */
export async function streamChat(options = {}, onChunk = null) {
  const chunkCallback = onChunk || options.onChunk;
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
    maxTokens: options.maxTokens,
    stream: true
  });

  const authHeader = apiKey ? (apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`) : 'Bearer none';

  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (options.signal && options.signal.aborted) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }

    try {
      const isLocal = isLocalOrigin(targetUrl);

      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && isLocal && targetUrl.startsWith('http:')) {
        throw new Error(
          'Browser Security (Mixed Content): Web HTTPS tidak dapat menghubungi http://localhost secara langsung. ' +
          'Solusi: (1) Aktifkan "Tunnel" di dasbor 9Router untuk mendapatkan URL HTTPS publik, atau ' +
          '(2) Jalankan Pecut AI secara lokal via npm run dev (http://localhost:5173).'
        );
      }

      const fetchOpts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(payload)
      };
      if (options.signal) {
        fetchOpts.signal = options.signal;
      }

      let res;
      if (isLocal) {
        res = await fetch(targetUrl, fetchOpts);
      } else if (provider === 'ninerouter' || provider === 'custom') {
        try {
          res = await fetch(targetUrl, fetchOpts);
        } catch (_) {
          const proxyOpts = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
              'x-target-url': targetUrl
            },
            body: JSON.stringify(payload)
          };
          if (options.signal) proxyOpts.signal = options.signal;
          res = await fetch('/api/ai/proxy', proxyOpts);
        }
      } else {
        const proxyOpts = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'x-target-url': targetUrl
          },
          body: JSON.stringify(payload)
        };
        if (options.signal) proxyOpts.signal = options.signal;
        res = await fetch('/api/ai/proxy', proxyOpts);
      }

      if (!res.ok) {
        const rawData = await parseRobustJson(res).catch(() => ({}));
        const errObj = Array.isArray(rawData) ? rawData[0] : rawData;
        const msg = errObj?.error?.message
          || errObj?.error
          || (typeof errObj === 'string' ? errObj : `HTTP ${res.status}: ${res.statusText}`);

        if (res.status === 400 && msg.toLowerCase().includes('max_tokens') && payload.max_tokens > 4096 && attempt < maxRetries) {
          payload.max_tokens = 4096;
          continue;
        }

        if (res.status === 429 && attempt < maxRetries) {
          const retryHeader = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
          let delayMs = 1500 * Math.pow(2, attempt);
          if (retryHeader) {
            const parsedSeconds = parseInt(retryHeader, 10);
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              delayMs = Math.min(parsedSeconds * 1000, 10000);
            }
          }
          await abortableSleep(delayMs, options.signal);
          continue;
        }

        const isHighDemand = res.status === 503 || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('temporarily unavailable');
        if (isHighDemand && attempt < maxRetries) {
          await abortableSleep(1500 * (attempt + 1), options.signal);
          continue;
        }

        throw new Error(msg);
      }

      const contentType = (res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : '') || '';

      // If server returned non-stream JSON (e.g. test mock or non-streaming provider)
      if (!contentType.includes('text/event-stream') || !res.body || typeof res.body.getReader !== 'function') {
        const data = await parseRobustJson(res);
        const choice = data.choices?.[0];
        const message = choice?.message;
        const finishReason = choice?.finish_reason || choice?.native_finish_reason || '';
        let content = message?.content || choice?.text || '';
        if (Array.isArray(content)) {
          content = content.map(part => part?.text || part?.content || (typeof part === 'string' ? part : '')).join('');
        }
        let reasoning = (message?.reasoning || message?.reasoning_content || '').trim();

        if (typeof content === 'string' && content.includes('<think>')) {
          const thinkBlocks = [];
          const cleaned = content.replace(/<think>([\s\S]*?)<\/think>/gi, (_, inner) => {
            if (inner && inner.trim()) thinkBlocks.push(inner.trim());
            return '';
          });
          if (thinkBlocks.length > 0) {
            reasoning = [reasoning, ...thinkBlocks].filter(Boolean).join('\n\n');
          }
          content = cleaned.trim();
        }

        const isReasoningOnly = !content && Boolean(reasoning);
        if (isReasoningOnly) content = reasoning;

        if (typeof chunkCallback === 'function') {
          chunkCallback({
            deltaText: content,
            text: content,
            deltaReasoning: reasoning,
            reasoning,
            isReasoningOnly,
            done: true,
            finishReason,
            model,
            provider
          });
        }

        return {
          text: content,
          reasoning,
          raw: data,
          provider,
          model,
          finishReason,
          truncated: finishReason === 'length',
          isReasoningOnly,
          usage: {
            promptTokens: Number(data.usage?.prompt_tokens || 0),
            completionTokens: Number(data.usage?.completion_tokens || 0),
            totalTokens: Number(data.usage?.total_tokens || 0)
          }
        };
      }

      // Live SSE stream processing
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let accumulatedReasoning = '';
      let finishReason = '';
      let inInlineThink = false;
      let modelName = model;
      let rawUsage = null;

      try {
        while (true) {
          if (options.signal && options.signal.aborted) {
            await reader.cancel().catch(() => {});
            throw new DOMException('The user aborted a request.', 'AbortError');
          }

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith(':')) continue;

            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (dataStr === '[DONE]') {
                break;
              }

              let chunk;
              try {
                chunk = JSON.parse(dataStr);
              } catch (_) {
                continue;
              }

              if (chunk.model) modelName = chunk.model;
              if (chunk.usage) rawUsage = chunk.usage;

              const choice = chunk.choices?.[0];
              if (!choice) continue;

              if (choice.finish_reason) {
                finishReason = choice.finish_reason;
              }

              const delta = choice.delta || {};

              // 1. Explicit reasoning fields (e.g. DeepSeek-R1 / VibeCoding / Nemotron)
              const directReasoning = delta.reasoning_content || delta.reasoning || '';
              if (directReasoning) {
                accumulatedReasoning += directReasoning;
                if (typeof chunkCallback === 'function') {
                  chunkCallback({
                    deltaText: '',
                    text: accumulatedText,
                    deltaReasoning: directReasoning,
                    reasoning: accumulatedReasoning,
                    isReasoningOnly: !accumulatedText && accumulatedReasoning.length > 0,
                    done: false,
                    model: modelName,
                    provider
                  });
                }
              }

              // 2. Content delta (handling inline <think> tags if present)
              let rawContentDelta = delta.content;
              if (Array.isArray(rawContentDelta)) {
                rawContentDelta = rawContentDelta.map(part => part?.text || part?.content || (typeof part === 'string' ? part : '')).join('');
              }

              if (typeof rawContentDelta === 'string' && rawContentDelta.length > 0) {
                let remaining = rawContentDelta;
                let textDelta = '';
                let reasoningDelta = '';

                while (remaining.length > 0) {
                  if (inInlineThink) {
                    const closeIdx = remaining.indexOf('</think>');
                    const codeStartIdx = remaining.search(/(<!DOCTYPE|<html|```html|```[a-z]*\n)/i);

                    if (closeIdx !== -1) {
                      const thinkPart = remaining.slice(0, closeIdx);
                      accumulatedReasoning += thinkPart;
                      reasoningDelta += thinkPart;
                      remaining = remaining.slice(closeIdx + 8);
                      inInlineThink = false;
                    } else if (codeStartIdx !== -1) {
                      // Model omitted </think> and immediately started writing code/HTML
                      const thinkPart = remaining.slice(0, codeStartIdx);
                      accumulatedReasoning += thinkPart;
                      reasoningDelta += thinkPart;
                      remaining = remaining.slice(codeStartIdx);
                      inInlineThink = false;
                    } else {
                      accumulatedReasoning += remaining;
                      reasoningDelta += remaining;
                      remaining = '';
                    }
                  } else {
                    const openIdx = remaining.indexOf('<think>');
                    if (openIdx !== -1) {
                      const textPart = remaining.slice(0, openIdx);
                      accumulatedText += textPart;
                      textDelta += textPart;
                      remaining = remaining.slice(openIdx + 7);
                      inInlineThink = true;
                    } else {
                      accumulatedText += remaining;
                      textDelta += remaining;
                      remaining = '';
                    }
                  }
                }

                if (typeof chunkCallback === 'function' && (textDelta || reasoningDelta)) {
                  chunkCallback({
                    deltaText: textDelta,
                    text: accumulatedText,
                    deltaReasoning: reasoningDelta,
                    reasoning: accumulatedReasoning,
                    isReasoningOnly: !accumulatedText && accumulatedReasoning.length > 0,
                    done: false,
                    model: modelName,
                    provider
                  });
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock?.();
      }

      // Check if accumulatedReasoning contains unclosed code (e.g. model output <!DOCTYPE or ``` without closing </think>)
      if (accumulatedReasoning) {
        const codeStart = accumulatedReasoning.search(/(<!DOCTYPE|<html|```html|```[a-z]*\n)/i);
        if (codeStart !== -1) {
          const thoughtPart = accumulatedReasoning.slice(0, codeStart).trim();
          const codePart = accumulatedReasoning.slice(codeStart).trim();
          accumulatedReasoning = thoughtPart;
          accumulatedText = accumulatedText ? `${accumulatedText}\n${codePart}` : codePart;
        }
      }

      const hasContent = Boolean(accumulatedText.trim());
      const hasReasoning = Boolean(accumulatedReasoning.trim());
      let isReasoningOnly = false;

      if (!hasContent && hasReasoning) {
        accumulatedText = accumulatedReasoning;
        isReasoningOnly = true;
      }

      if (!accumulatedText && !accumulatedReasoning) {
        throw new Error('AI provider returned an empty completion.');
      }

      if (typeof chunkCallback === 'function') {
        chunkCallback({
          deltaText: '',
          text: accumulatedText,
          deltaReasoning: '',
          reasoning: accumulatedReasoning,
          isReasoningOnly,
          done: true,
          finishReason,
          model: modelName,
          provider
        });
      }

      return {
        text: accumulatedText,
        reasoning: accumulatedReasoning,
        raw: { model: modelName, usage: rawUsage },
        provider,
        model: modelName,
        finishReason,
        truncated: finishReason === 'length',
        isReasoningOnly,
        usage: {
          promptTokens: Number(rawUsage?.prompt_tokens || rawUsage?.promptTokens || 0),
          completionTokens: Number(rawUsage?.completion_tokens || rawUsage?.completionTokens || 0),
          totalTokens: Number(rawUsage?.total_tokens || rawUsage?.totalTokens || 0)
        }
      };
    } catch (err) {
      if (err.name === 'AbortError' || (options.signal && options.signal.aborted)) {
        throw err;
      }

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
        await abortableSleep(1500 * (attempt + 1), options.signal);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('AI request failed after retries.');
}
