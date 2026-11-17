/**
 * Pecut AI — Unified Client AI Service
 * Apache-2.0 License
 *
 * Implements a 3-tier resolution cascade:
 * Tier 1: Client BYOK in localStorage (dispatches to /api/ai/proxy or direct localhost)
 * Tier 2: Server-side .env configuration (via /api/ai/* endpoints)
 * Tier 3: Deterministic offline structural analyzer & mock generator
 */

import { loadBYOKConfig } from '../../modules/storage.js';
import { PROVIDER_PRESETS } from '../../data/models.js';
import { analyzePromptLocally } from '../../modules/optimizer.js';

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
 * Builds a standardized OpenAI-compatible Chat Completion request payload.
 * @param {Object} options
 * @param {string} options.model
 * @param {Array<{ role: string, content: string }>} options.messages
 * @param {string} [options.systemPrompt]
 * @param {number} [options.temperature=0.3]
 * @param {number} [options.maxTokens=2048]
 * @returns {Object}
 */
export function buildChatPayload({ model, messages = [], systemPrompt, temperature = 0.3, maxTokens = 2048 }) {
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
 * @returns {Promise<{ text: string, raw: Object, provider: string, model: string }>}
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
      let res;
      if (isLocalOrigin(targetUrl)) {
        // Direct local dispatch (e.g. Ollama / LMStudio)
        res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(payload)
        });
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
        const rawData = await res.json().catch(() => ({}));
        const errObj = Array.isArray(rawData) ? rawData[0] : rawData;
        const msg = errObj?.error?.message 
          || errObj?.error 
          || (typeof errObj === 'string' ? errObj : `HTTP ${res.status}: ${res.statusText}`);

        // If Google or another provider returns 503 or "high demand", auto-retry after backoff
        const isHighDemand = res.status === 503 || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('temporarily unavailable');
        if (isHighDemand && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }

        throw new Error(msg);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('AI provider returned an empty completion.');
      }

      return {
        text: content,
        raw: data,
        provider,
        model
      };
    } catch (err) {
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
  if (provider === 'gemini') {
    modelsUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  } else if (provider === 'openrouter') {
    modelsUrl = 'https://openrouter.ai/api/v1/models';
  } else if (provider === 'groq') {
    modelsUrl = 'https://api.groq.com/openai/v1/models';
  } else if (provider === 'openai') {
    modelsUrl = 'https://api.openai.com/v1/models';
  } else {
    modelsUrl = `${baseUrl.replace(/\/chat\/completions$/, '')}/models`;
  }

  const authHeader = apiKey ? (apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`) : '';

  let res;
  if (isLocalOrigin(modelsUrl)) {
    res = await fetch(modelsUrl, {
      headers: authHeader ? { 'Authorization': authHeader } : {}
    });
  } else {
    res = await fetch('/api/ai/proxy', {
      headers: {
        'Authorization': authHeader || 'Bearer none',
        'x-target-url': modelsUrl
      }
    });
  }

  if (!res.ok) {
    const rawData = await res.json().catch(() => ({}));
    const errObj = Array.isArray(rawData) ? rawData[0] : rawData;
    throw new Error(errObj?.error?.message || errObj?.error || `HTTP ${res.status}: Failed to fetch models`);
  }

  const data = await res.json();
  const rawList = data.data || data.models || [];
  return rawList
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
      maxTokens: 5,
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
 * Optimizes a user prompt using the 3-tier cascade.
 * @param {string} prompt
 * @param {string[]} goals
 * @returns {Promise<Object>}
 */
export async function optimizePromptWithAI(prompt, goals = []) {
  const byok = loadBYOKConfig();

  // Tier 1: Client BYOK configured
  if (byok.apiKey || byok.provider === 'custom') {
    try {
      const goalsText = goals.length ? goals.join(', ') : 'clarity, structure, precision, actionable constraints';
      const systemPrompt = `You are Pecut AI's Senior Prompt Optimization Engine.
Analyze the user's raw prompt and transform it into a high-performance, structured, production-grade prompt.
Focus Goals: ${goalsText}.

You MUST respond strictly with a valid JSON object matching this schema, without markdown code fences:
{
  "optimizedPrompt": "Enhanced prompt with Role, Objective, Context, Instructions, Constraints, Output Format",
  "analysis": "A concise expert review detailing original clarity, missing sections, and ambiguities",
  "improvements": ["Specific improvement 1", "Specific improvement 2", "Specific improvement 3"]
}`;

      const res = await completeChat({
        systemPrompt,
        messages: [{ role: 'user', content: `PROMPT TO OPTIMIZE:\n${prompt}` }],
        temperature: 0.2
      });

      // Parse JSON from text with robust regex extraction
      let cleaned = res.text.trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      } else {
        if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);
      return {
        mode: 'ai',
        provider: res.provider,
        model: res.model,
        hasKey: true,
        ...parsed
      };
    } catch (err) {
      // Fallback to local structural
      return {
        mode: 'fallback',
        error: err.message
      };
    }
  }

  // Tier 2: Check server .env
  try {
    const serverRes = await fetch('/api/ai/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, goals })
    });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data.mode === 'ai') return data;
    }
  } catch (_) {
    // Continue to Tier 3
  }

  // Tier 3: Local Deterministic Analysis
  const localAnalysis = analyzePromptLocally(prompt);
  return {
    mode: 'demo',
    analysis: `Local Structural Analysis: Found ${localAnalysis.words} words across ${localAnalysis.sections.length} core sections (${localAnalysis.sections.join(', ') || 'No headers detected'}).`,
    improvements: [
      localAnalysis.hasRole ? 'Role is established.' : 'Add a clear # Role (e.g. Senior Software Architect).',
      localAnalysis.hasOutput ? 'Output format defined.' : 'Specify # Output Format (e.g. Markdown table or bullet points).',
      localAnalysis.hasConstraints ? 'Constraints present.' : 'Add # Constraints to prevent hallucinations and establish boundaries.'
    ]
  };
}

/**
 * Executes a single step of a Pecut Flow pipeline via the 3-tier cascade.
 * @param {Object} stepData
 * @returns {Promise<Object>}
 */
export async function executeFlowStep(stepData) {
  const byok = loadBYOKConfig();

  // Tier 1: Client BYOK configured
  if (byok.apiKey || byok.provider === 'custom') {
    try {
      const promptText = `WORKFLOW INPUT:\n${stepData.inputData}\n\nPREVIOUS STEP OUTPUT:\n${stepData.previousOutput || '(Initial step - no previous output)'}\n\nTASK INSTRUCTIONS:\n${stepData.stepInstruction}`;
      const systemPrompt = `You are Pecut AI Workflow Engine executing Step ${Number(stepData.stepIndex) + 1}: "${stepData.stepTitle}". Provide a direct, authoritative, structured output. Avoid filler text.`;

      const res = await completeChat({
        systemPrompt,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.3
      });

      return {
        mode: 'ai',
        flowId: stepData.flowId,
        stepIndex: stepData.stepIndex,
        stepTitle: stepData.stepTitle,
        output: res.text,
        provider: res.provider,
        model: res.model,
        hasKey: true
      };
    } catch (err) {
      // Fallback to local generation
      return {
        mode: 'demo',
        stepIndex: stepData.stepIndex,
        stepTitle: stepData.stepTitle,
        output: `### [STEP ${stepData.stepIndex + 1}: ${stepData.stepTitle}]\n\nProcessed: ${stepData.inputData}\n\nOutcome:\n- Step execution generated locally.\n- Note: ${err.message}`,
        hasKey: false
      };
    }
  }

  // Tier 2: Check server .env
  try {
    const serverRes = await fetch('/api/ai/flow/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stepData)
    });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data.mode === 'ai') return data;
    }
  } catch (_) {
    // Continue to Tier 3
  }

  // Tier 3: Local Offline Generation
  return {
    mode: 'demo',
    stepIndex: stepData.stepIndex,
    stepTitle: stepData.stepTitle,
    output: `### [STEP ${stepData.stepIndex + 1}: ${stepData.stepTitle} — Local Mode]\n\nProcessing "${stepData.inputData}":\n1. Structured output generated by Pecut AI local engine.\n2. Connect an AI provider in Settings to run live inference with OpenRouter, Gemini, or Groq.`,
    hasKey: false
  };
}

/**
 * Returns summary of current active provider for UI status indicators.
 * @returns {Object}
 */
export function getActiveProviderInfo() {
  const config = loadBYOKConfig();
  const preset = PROVIDER_PRESETS[config.provider] || PROVIDER_PRESETS.openrouter;
  const hasKey = Boolean(config.apiKey && config.apiKey.trim()) || config.provider === 'custom';
  return {
    provider: config.provider,
    name: preset.name,
    model: config.model || preset.defaultModel,
    hasKey,
    isLocal: isLocalOrigin(config.baseUrl || preset.baseUrl)
  };
}
