/**
 * Pecut AI — Workflow Persistence, CRUD & JSON Schema Exporter (Pecut Flow 2.0)
 * Apache-2.0 License
 */

import { DEFAULT_FLOWS } from '../../data/flows.js';
import {
  FLOW_SCHEMA_VERSION,
  generateFlowId,
  generateStepId,
  normalizeFlowV2,
  validateFlowV2,
  migrateLegacyFlowToV2,
  isSafeId
} from './schema.js';

export const FLOWS_STORAGE_KEY = 'pecut_flows';

/**
 * Exact unmodified step instructions from legacy starter workflows (Pecut AI 1.8 / pre-1.9-fix).
 * Used for conservative migration: only steps that match these exact legacy strings are upgraded,
 * guaranteeing that user-edited steps or customized workflows are never overwritten.
 */
export const LEGACY_STARTER_INSTRUCTIONS = {
  'flow-content': [
    'Generate 3 high-impact angles or hooks for the topic. Contrast common misconceptions with fresh perspectives.',
    'Using the best angle from Step 1, design a detailed 4-section outline with key talking points and bullet explanations.',
    'Transform the outline from Step 2 into a crisp, engaging social media post with a compelling opening line and clear CTA.'
  ],
  'flow-code': [
    'Define the architecture, data schemas, interface contracts, and key edge cases for the given requirement.',
    'Write the complete, clean, modular implementation based on the specification from Step 1 with clear comments.',
    'Draft exhaustive unit and integration test scenarios covering normal operation, failure modes, and error recovery.'
  ],
  'flow-study': [
    'Break down the core topic into its 3 fundamental principles without using confusing jargon.',
    'Construct an intuitive real-world analogy that illustrates how these principles function in practice.',
    'Create 3 scenario-based assessment questions with detailed answer explanations to verify complete mastery.'
  ]
};

/**
 * Creates canonical starter flows seeded from DEFAULT_FLOWS.
 * @returns {Array<Object>}
 */
export function getStarterFlowsV2() {
  return DEFAULT_FLOWS.map(f => migrateLegacyFlowToV2(f));
}

/**
 * Loads all workflows from localStorage, automatically migrating legacy v1 flows or seeding if empty.
 * @returns {Array<Object>}
 */
export function loadFlows() {
  try {
    const raw = localStorage.getItem(FLOWS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Normalize each item to ensure v2 compliance
        let needsResave = false;
        const starterMap = new Map(getStarterFlowsV2().map(f => [f.id, f]));
        const normalized = parsed.map(f => {
          let flowObj = f;
          if (flowObj.schemaVersion !== FLOW_SCHEMA_VERSION || !Array.isArray(flowObj.steps) || (flowObj.steps[0] && !flowObj.steps[0].id)) {
            needsResave = true;
            flowObj = migrateLegacyFlowToV2(flowObj);
          }

          // Conservative migration: Only update built-in starter flows for steps that still carry
          // the exact un-customized legacy default instruction, preserving all user customizations,
          // custom steps, custom titles, custom models, and edited prompts.
          if (flowObj.isBuiltIn && starterMap.has(flowObj.id) && Array.isArray(flowObj.steps)) {
            const canonicalStarter = starterMap.get(flowObj.id);
            const legacyDefaults = LEGACY_STARTER_INSTRUCTIONS[flowObj.id];

            if (legacyDefaults && canonicalStarter) {
              let updatedSteps = false;
              const migratedSteps = flowObj.steps.map((step, idx) => {
                const legacyText = legacyDefaults[idx];
                const canonicalStep = canonicalStarter.steps[idx];

                // Only upgrade if this step instruction matches the exact legacy default instruction
                if (legacyText && canonicalStep && typeof step.instruction === 'string' && step.instruction.trim() === legacyText.trim()) {
                  updatedSteps = true;
                  return {
                    ...step,
                    instruction: canonicalStep.instruction
                  };
                }
                // Otherwise, preserve user's customized instruction and step configuration
                return step;
              });

              if (updatedSteps) {
                needsResave = true;
                flowObj = {
                  ...flowObj,
                  steps: migratedSteps
                };
              }
            }
          }

          return normalizeFlowV2(flowObj);
        });

        if (needsResave) {
          persistFlows(normalized);
        }
        return normalized;
      }
    }
  } catch (_) {
    // Fallback if corrupted
  }

  // Initial seed from built-in flows
  const starter = getStarterFlowsV2();
  persistFlows(starter);
  return starter;
}

/**
 * Persists an array of workflow objects directly to localStorage.
 * @param {Array<Object>} flows
 */
export function persistFlows(flows) {
  if (!Array.isArray(flows)) return;
  // If accidentally emptied, keep built-in flows
  if (flows.length === 0) {
    flows = getStarterFlowsV2();
  }
  localStorage.setItem(FLOWS_STORAGE_KEY, JSON.stringify(flows));
}

/**
 * Retrieves a single workflow by ID.
 * @param {string} flowId
 * @returns {Object|null}
 */
export function getFlowById(flowId) {
  const flows = loadFlows();
  return flows.find(f => f.id === flowId) || null;
}

/**
 * Creates and persists a new custom workflow.
 * @param {Object} [partial]
 * @returns {Object}
 */
export function createFlow(partial = {}) {
  const flows = loadFlows();
  const newFlow = normalizeFlowV2({
    ...partial,
    id: partial.id || generateFlowId(),
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: Array.isArray(partial.steps) && partial.steps.length > 0
      ? partial.steps
      : [{ id: generateStepId(0), title: 'Initial Step', instruction: 'Analyze input data:\n{{input}}' }]
  });

  flows.unshift(newFlow);
  persistFlows(flows);
  return newFlow;
}

/**
 * Saves updates to an existing workflow.
 * @param {Object} partialFlow
 * @returns {Object|null}
 */
export function saveFlow(partialFlow) {
  if (!partialFlow || !partialFlow.id) return null;
  const flows = loadFlows();
  const idx = flows.findIndex(f => f.id === partialFlow.id);

  if (idx === -1) {
    // If not existing, create new
    return createFlow(partialFlow);
  }

  const existing = flows[idx];
  const updated = normalizeFlowV2({
    ...existing,
    ...partialFlow,
    id: existing.id, // Preserve immutable ID
    isBuiltIn: existing.isBuiltIn, // Preserve built-in flag
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  });

  flows[idx] = updated;
  persistFlows(flows);
  return updated;
}

/**
 * Duplicates an existing workflow with a new ID and title suffix.
 * @param {string} flowId
 * @returns {Object|null}
 */
export function duplicateFlow(flowId) {
  const source = getFlowById(flowId);
  if (!source) return null;

  const now = new Date().toISOString();
  // Ensure all steps receive fresh stable IDs
  const freshSteps = source.steps.map((s, idx) => ({
    ...s,
    id: generateStepId(idx)
  }));

  const duplicated = normalizeFlowV2({
    ...source,
    id: generateFlowId(),
    title: `${source.title} (Copy)`,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
    steps: freshSteps
  });

  const flows = loadFlows();
  flows.unshift(duplicated);
  persistFlows(flows);
  return duplicated;
}

/**
 * Deletes a workflow by ID.
 * @param {string} flowId
 * @returns {boolean}
 */
export function deleteFlow(flowId) {
  const flows = loadFlows();
  const filtered = flows.filter(f => f.id !== flowId);
  if (filtered.length !== flows.length) {
    persistFlows(filtered);
    return true;
  }
  return false;
}

/**
 * Resets or re-seeds built-in workflows without deleting user-created flows.
 * @returns {Array<Object>}
 */
export function resetBuiltInFlows() {
  const current = loadFlows();
  const customFlows = current.filter(f => !f.isBuiltIn);
  const freshBuiltIns = getStarterFlowsV2();

  const combined = [...freshBuiltIns, ...customFlows];
  persistFlows(combined);
  return combined;
}

/**
 * Strips any sensitive properties (e.g. accidental api keys) from a flow object.
 * @param {Object} flow
 * @returns {Object}
 */
function sanitizeFlowSecrets(flow) {
  const copy = JSON.parse(JSON.stringify(flow));
  delete copy.apiKey;
  delete copy.token;
  delete copy.secret;
  if (Array.isArray(copy.steps)) {
    copy.steps.forEach(s => {
      delete s.apiKey;
      delete s.token;
      delete s.secret;
    });
  }
  return copy;
}

/**
 * Exports specified flows (or all flows) as a validated pecut.flow.v2 JSON document.
 * @param {string[]|null} [flowIds=null]
 * @returns {string}
 */
export function exportFlowsJSON(flowIds = null) {
  const allFlows = loadFlows();
  const selected = Array.isArray(flowIds) && flowIds.length > 0
    ? allFlows.filter(f => flowIds.includes(f.id))
    : allFlows;

  const sanitizedFlows = selected.map(f => sanitizeFlowSecrets(f));

  const exportDocument = {
    schemaVersion: FLOW_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    flows: sanitizedFlows
  };

  return JSON.stringify(exportDocument, null, 2);
}

/**
 * Imports flows from a JSON document, validating schema and stripping secrets.
 * @param {string} jsonString
 * @returns {{ success: boolean, importedCount: number, errors: string[] }}
 */
export function importFlowsJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, importedCount: 0, errors: ['Invalid JSON document structure.'] };
    }

    const rawFlows = Array.isArray(parsed.flows) ? parsed.flows : (parsed.id && parsed.steps ? [parsed] : null);
    if (!rawFlows || rawFlows.length === 0) {
      return { success: false, importedCount: 0, errors: ['No workflows found in import payload.'] };
    }

    const existingFlows = loadFlows();
    const existingIds = new Set(existingFlows.map(f => f.id));
    const validatedFlows = [];
    const errors = [];

    rawFlows.forEach((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        errors.push(`Flow ${i + 1} is not a valid JSON object.`);
        return;
      }

      // Explicitly reject malicious / unsafe IDs in raw flow or raw steps
      if (raw.id && !isSafeId(raw.id)) {
        errors.push(`Flow ${i + 1} has an invalid or unsafe flow ID "${raw.id}".`);
        return;
      }
      if (Array.isArray(raw.steps)) {
        for (let sIdx = 0; sIdx < raw.steps.length; sIdx++) {
          const step = raw.steps[sIdx];
          if (step && step.id && !isSafeId(step.id)) {
            errors.push(`Flow ${i + 1} step ${sIdx + 1} has an invalid or unsafe step ID "${step.id}".`);
            return;
          }
        }
      }

      // Explicitly reject flows with missing title or missing steps
      if (!raw.title || typeof raw.title !== 'string' || !raw.title.trim()) {
        errors.push(`Flow ${i + 1} is missing a required title.`);
        return;
      }
      if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
        errors.push(`Flow ${i + 1} ("${raw.title}") must have at least one step.`);
        return;
      }

      const sanitized = sanitizeFlowSecrets(raw);
      const normalized = normalizeFlowV2(sanitized);

      const check = validateFlowV2(normalized);
      if (!check.valid) {
        errors.push(`Flow ${i + 1} ("${normalized.title}") validation error: ${check.errors.join('; ')}`);
        return;
      }

      // If ID collision with existing, assign new ID to avoid overwriting existing workflows
      if (existingIds.has(normalized.id)) {
        normalized.id = generateFlowId();
        normalized.title = `${normalized.title} (Imported)`;
      }

      // Imported flows are never marked as built-in system flows
      normalized.isBuiltIn = false;
      existingIds.add(normalized.id);
      validatedFlows.push(normalized);
    });

    if (validatedFlows.length === 0) {
      return { success: false, importedCount: 0, errors: errors.length > 0 ? errors : ['No valid workflows could be imported.'] };
    }

    const merged = [...validatedFlows, ...existingFlows];
    persistFlows(merged);
    return { success: true, importedCount: validatedFlows.length, errors };
  } catch (err) {
    return { success: false, importedCount: 0, errors: [`JSON Parse Error: ${err.message}`] };
  }
}
