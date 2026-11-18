/**
 * Pecut AI — Workflow Schema Definitions, Validation & Migrations (Pecut Flow 2.0)
 * Apache-2.0 License
 */

export const FLOW_SCHEMA_VERSION = 'pecut.flow.v2';

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Generates a stable, collision-resistant Flow ID.
 * @returns {string}
 */
export function generateFlowId() {
  return 'flow_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/**
 * Generates a stable, indexed Step ID.
 * @param {number} index
 * @returns {string}
 */
export function generateStepId(index = 0) {
  const num = Math.max(0, parseInt(index, 10) || 0) + 1;
  return `step_${num}_` + Math.random().toString(36).slice(2, 7);
}

/**
 * Validates whether an ID string is safe against HTML / attribute injection.
 * @param {string} id
 * @returns {boolean}
 */
export function isSafeId(id) {
  return typeof id === 'string' && SAFE_ID_REGEX.test(id.trim());
}

/**
 * Normalizes a single workflow step into canonical v2 structure.
 * @param {Object} rawStep
 * @param {number} index
 * @returns {Object}
 */
export function normalizeStepV2(rawStep = {}, index = 0) {
  const rawId = typeof rawStep.id === 'string' ? rawStep.id.trim() : '';
  const id = isSafeId(rawId) ? rawId : generateStepId(index);
  const title = typeof rawStep.title === 'string' ? rawStep.title.trim() : `Step ${index + 1}`;
  const instruction = typeof rawStep.instruction === 'string' ? rawStep.instruction.trim() : '';

  const provider = typeof rawStep.provider === 'string' && rawStep.provider.trim()
    ? rawStep.provider.trim()
    : 'inherit';

  const model = typeof rawStep.model === 'string' && rawStep.model.trim()
    ? rawStep.model.trim()
    : 'inherit';

  const contextProfileId = typeof rawStep.contextProfileId === 'string' && rawStep.contextProfileId.trim()
    ? rawStep.contextProfileId.trim()
    : 'inherit';

  const tempNum = parseFloat(rawStep.temperature);
  const temperature = !isNaN(tempNum) && tempNum >= 0 && tempNum <= 2 ? tempNum : 0.3;

  const maxTokensNum = parseInt(rawStep.maxTokens, 10);
  const maxTokens = !isNaN(maxTokensNum) && maxTokensNum >= 256 && maxTokensNum <= 65536 ? maxTokensNum : 4096;

  return {
    id,
    title,
    instruction,
    provider,
    model,
    contextProfileId,
    temperature,
    maxTokens
  };
}

/**
 * Normalizes an entire workflow object into canonical pecut.flow.v2 structure.
 * @param {Object} rawFlow
 * @returns {Object}
 */
export function normalizeFlowV2(rawFlow = {}) {
  const rawId = typeof rawFlow.id === 'string' ? rawFlow.id.trim() : '';
  const id = isSafeId(rawId) ? rawId : generateFlowId();

  const title = typeof rawFlow.title === 'string' && rawFlow.title.trim()
    ? rawFlow.title.trim()
    : 'Untitled Workflow';

  const category = typeof rawFlow.category === 'string' && rawFlow.category.trim()
    ? rawFlow.category.trim()
    : 'General';

  const description = typeof rawFlow.description === 'string'
    ? rawFlow.description.trim()
    : '';

  const isBuiltIn = Boolean(rawFlow.isBuiltIn);

  const defaultContextProfileId = typeof rawFlow.defaultContextProfileId === 'string'
    ? rawFlow.defaultContextProfileId.trim()
    : '';

  const now = new Date().toISOString();
  const createdAt = typeof rawFlow.createdAt === 'string' && !isNaN(Date.parse(rawFlow.createdAt))
    ? rawFlow.createdAt
    : now;

  const updatedAt = typeof rawFlow.updatedAt === 'string' && !isNaN(Date.parse(rawFlow.updatedAt))
    ? rawFlow.updatedAt
    : now;

  const rawSteps = Array.isArray(rawFlow.steps) ? rawFlow.steps : [];
  const steps = rawSteps.length > 0
    ? rawSteps.map((s, idx) => normalizeStepV2(s, idx))
    : [normalizeStepV2({ title: 'Initial Step', instruction: 'Process {{input}}' }, 0)];

  return {
    schemaVersion: FLOW_SCHEMA_VERSION,
    id,
    title,
    category,
    description,
    isBuiltIn,
    defaultContextProfileId,
    createdAt,
    updatedAt,
    steps
  };
}

/**
 * Migrates a legacy v1 flow (e.g. from DEFAULT_FLOWS) to canonical v2 schema.
 * @param {Object} legacyFlow
 * @returns {Object}
 */
export function migrateLegacyFlowToV2(legacyFlow = {}) {
  const isBuiltIn = legacyFlow.id === 'flow-content' || legacyFlow.id === 'flow-code' || legacyFlow.id === 'flow-study' || Boolean(legacyFlow.isBuiltIn);

  const rawSteps = Array.isArray(legacyFlow.steps) ? legacyFlow.steps : [];
  const steps = rawSteps.map((s, idx) => ({
    id: generateStepId(idx),
    title: s.title || `Step ${idx + 1}`,
    instruction: s.instruction || '',
    provider: 'inherit',
    model: 'inherit',
    contextProfileId: 'inherit',
    temperature: 0.3,
    maxTokens: 4096
  }));

  return normalizeFlowV2({
    ...legacyFlow,
    isBuiltIn,
    steps
  });
}

/**
 * Validates whether an object strictly conforms to pecut.flow.v2 schema invariants.
 * @param {any} flow
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFlowV2(flow) {
  const errors = [];
  if (!flow || typeof flow !== 'object' || Array.isArray(flow)) {
    return { valid: false, errors: ['Flow must be a valid JSON object.'] };
  }

  if (flow.schemaVersion && flow.schemaVersion !== FLOW_SCHEMA_VERSION) {
    errors.push(`Unsupported schema version "${flow.schemaVersion}". Expected "${FLOW_SCHEMA_VERSION}".`);
  }

  if (!flow.id || !isSafeId(flow.id)) {
    errors.push(`Invalid flow ID: must match ${SAFE_ID_REGEX}`);
  }

  if (!flow.title || typeof flow.title !== 'string' || !flow.title.trim()) {
    errors.push('Workflow title is required and cannot be empty.');
  }

  if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
    errors.push('Workflow must contain at least 1 step.');
  } else {
    const seenStepIds = new Set();
    flow.steps.forEach((step, idx) => {
      if (!step || typeof step !== 'object') {
        errors.push(`Step at index ${idx} is not a valid object.`);
        return;
      }
      if (!step.id || !isSafeId(step.id)) {
        errors.push(`Step at index ${idx} has an invalid or unsafe ID.`);
      } else if (seenStepIds.has(step.id)) {
        errors.push(`Duplicate step ID "${step.id}" detected at step ${idx + 1}.`);
      } else {
        seenStepIds.add(step.id);
      }

      if (!step.instruction || typeof step.instruction !== 'string' || !step.instruction.trim()) {
        errors.push(`Step ${idx + 1} ("${step.title || 'Untitled'}") must have instruction text.`);
      }

      if (step.temperature !== undefined && (typeof step.temperature !== 'number' || isNaN(step.temperature) || step.temperature < 0 || step.temperature > 2)) {
        errors.push(`Step ${idx + 1} ("${step.title || 'Untitled'}") has invalid temperature. Must be between 0.0 and 2.0.`);
      }

      if (step.maxTokens !== undefined && (typeof step.maxTokens !== 'number' || isNaN(step.maxTokens) || step.maxTokens < 256 || step.maxTokens > 65536)) {
        errors.push(`Step ${idx + 1} ("${step.title || 'Untitled'}") has invalid maxTokens. Must be between 256 and 65536.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
