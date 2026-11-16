/**
 * Pecut AI — AI Service Abstraction Layer (Stage 2 BYOK Client)
 * Apache-2.0 License
 *
 * Communicates with the secure local backend server (/api/ai/*).
 * Zero credentials/secrets are stored or handled in the browser.
 */

export const SUPPORTED_PROVIDERS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-1.5-flash',
    supportedModels: ['gemini-1.5-flash', 'gemini-1.5-pro']
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    supportedModels: ['gpt-4o-mini', 'gpt-4o']
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-sonnet-latest',
    supportedModels: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest']
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
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      hasKey: false,
      engine: 'Demo Engine (Local Structural)'
    };
  }
}

/**
 * Sends a prompt optimization request to the server BYOK engine.
 * @param {string} prompt - Original prompt string
 * @param {string[]} goals - Optimization goals
 * @returns {Promise<Object>}
 */
export async function optimizePromptWithAI(prompt, goals = []) {
  try {
    const res = await fetch('/api/ai/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, goals })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server responded with ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    return {
      mode: 'fallback',
      error: err.message
    };
  }
}
