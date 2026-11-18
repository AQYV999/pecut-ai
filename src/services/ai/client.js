/**
 * Pecut AI — Unified Client AI Service (Facade)
 * Apache-2.0 License
 *
 * Re-exports transport, provider discovery, and domain AI tasks for full
 * backward compatibility with app modules and unit tests.
 */

export {
  isLocalOrigin,
  parseRobustJson,
  buildChatPayload,
  completeChat
} from './transport.js';

export {
  fetchProviderModels,
  testAIConnection,
  getActiveProviderInfo
} from './providers.js';

export {
  optimizePromptWithAI,
  executeFlowStep
} from './tasks.js';
