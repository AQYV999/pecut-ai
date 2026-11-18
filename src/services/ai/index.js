/**
 * Pecut AI — AI Service Abstraction Layer
 * Apache-2.0 License
 */

import { PROVIDER_PRESETS } from '../../data/models.js';

export {
  completeChat,
  testAIConnection,
  fetchProviderModels,
  optimizePromptWithAI,
  executeFlowStep,
  getActiveProviderInfo,
  isLocalOrigin,
  parseRobustJson,
  buildChatPayload
} from './client.js';

export const SUPPORTED_PROVIDERS = Object.fromEntries(
  Object.entries(PROVIDER_PRESETS).map(([key, preset]) => [
    key,
    {
      id: preset.id,
      name: preset.name,
      defaultModel: preset.defaultModel
    }
  ])
);

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
      model: PROVIDER_PRESETS.openrouter.defaultModel,
      hasKey: false,
      engine: 'BYOK Ready'
    };
  }
}
