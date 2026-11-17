/**
 * Pecut AI — AI Service Abstraction Layer
 * Apache-2.0 License
 */

export {
  completeChat,
  testAIConnection,
  optimizePromptWithAI,
  executeFlowStep,
  getActiveProviderInfo,
  isLocalOrigin,
  buildChatPayload
} from './client.js';

export const SUPPORTED_PROVIDERS = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free'
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-1.5-flash'
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    defaultModel: 'llama-3.3-70b-versatile'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini'
  }
};

/**
 * Checks server-side AI provider configuration status.
 * @returns {Promise<{ status: string, provider: string, model: string, hasKey: boolean, engine: string }>}
 */
export async function checkAIStatus() {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) throw new Error('Status endpoint unavailable');
    return await res.json();
  } catch (_) {
    return {
      status: 'demo',
      provider: 'openrouter',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      hasKey: false,
      engine: 'BYOK Ready'
    };
  }
}
