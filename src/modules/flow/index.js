/**
 * Pecut AI — Pecut Flow 2.0 Module Facade
 * Apache-2.0 License
 */

export {
  FLOW_SCHEMA_VERSION,
  generateFlowId,
  generateStepId,
  normalizeFlowV2,
  normalizeStepV2,
  validateFlowV2,
  migrateLegacyFlowToV2
} from './schema.js';

export {
  FLOWS_STORAGE_KEY,
  loadFlows,
  saveFlow,
  createFlow,
  deleteFlow,
  duplicateFlow,
  resetBuiltInFlows,
  getFlowById,
  exportFlowsJSON,
  importFlowsJSON
} from './storage.js';

export {
  hasTemplateVariables,
  extractPlaceholders,
  interpolateStepPrompt
} from './interpolation.js';

export {
  validateStepReferences,
  computeInvalidatedSteps,
  validateStepParameters,
  validateContextProfiles,
  validateProviderCredentials
} from './validation.js';

export {
  resolveStepExecutionConfig,
  resolveContextProfilePrompt,
  executeWorkflowPipeline
} from './engine.js';

export {
  RUNS_STORAGE_KEY,
  MAX_FLOW_RUNS,
  MAX_RUN_OUTPUT_CHARS,
  MAX_TOTAL_RUN_OUTPUT_CHARS,
  MAX_RUNS_STORAGE_BYTES,
  createRunSnapshot,
  loadFlowRuns,
  saveFlowRun,
  getFlowRunById,
  getLatestRunForFlow,
  deleteFlowRun,
  clearFlowRuns
} from './runStorage.js';
