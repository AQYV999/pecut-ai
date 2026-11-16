/**
 * Pecut AI — AI Service Abstraction Layer (Stage 1 Foundation)
 * Apache-2.0 License
 *
 * Defines the service boundary for AI execution.
 * In Stage 1, this acts as the interface contract and returns deterministic local status.
 * Stage 2 will attach the real BYOK provider client (e.g., Gemini 1.5 Flash / OpenAI)
 * calling a secure local backend proxy reading from process.env, NEVER browser localStorage.
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

export const currentEngineState = {
  mode: 'demo', // 'demo' in Stage 1, 'byok' in Stage 2
  activeProvider: 'gemini',
  activeModel: 'gemini-1.5-flash',
  statusText: 'Demo Engine Active'
};

export function getEngineStatus() {
  return { ...currentEngineState };
}
