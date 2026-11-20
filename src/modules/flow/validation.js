/**
 * Pecut AI — Workflow Step Reference Validation & Output Invalidation (Pecut Flow 2.0)
 * Apache-2.0 License
 *
 * Implements Constraint 8:
 * - Detects forward references, self references, and dead step ID references
 * - Identifies and flags downstream cached results when steps are edited or reordered
 */

import { extractPlaceholders } from './interpolation.js';

/**
 * Validates all variable references across an array of workflow steps in execution order.
 * @param {Array<Object>} steps
 * @returns {{ isValid: boolean, errors: Array<{ stepIndex: number, stepId: string, placeholder: string, type: string, message: string }> }}
 */
export function validateStepReferences(steps = []) {
  if (!Array.isArray(steps)) {
    return { isValid: true, errors: [] };
  }

  const errors = [];
  const stepIdMap = new Map();
  steps.forEach((s, idx) => {
    if (s && s.id) {
      stepIdMap.set(s.id, idx);
    }
  });

  steps.forEach((step, stepIndex) => {
    if (!step || typeof step.instruction !== 'string') return;

    const placeholders = extractPlaceholders(step.instruction);
    placeholders.forEach(tag => {
      const lowerTag = (tag || '').toLowerCase();

      // 1. Check {{input}} -> Always valid
      if (lowerTag === 'input') return;

      // 2. Check {{prev}} or {{previous}}
      if (lowerTag === 'prev' || lowerTag === 'previous') {
        if (stepIndex === 0) {
          errors.push({
            stepIndex,
            stepId: step.id || `step_${stepIndex + 1}`,
            placeholder: tag,
            type: 'invalid_prev',
            message: `Step 1 cannot reference {{${tag}}} because it has no preceding step.`
          });
        }
        return;
      }

      // 3. Check 1-based index: {{stepN}}
      const indexMatch = tag.match(/^step(\d+)$/i);
      if (indexMatch) {
        const targetNum = parseInt(indexMatch[1], 10);
        if (targetNum < 1) {
          errors.push({
            stepIndex,
            stepId: step.id || `step_${stepIndex + 1}`,
            placeholder: tag,
            type: 'invalid_index',
            message: `Invalid step index {{${tag}}}. Step numbers start at 1.`
          });
        } else if (targetNum === stepIndex + 1) {
          errors.push({
            stepIndex,
            stepId: step.id || `step_${stepIndex + 1}`,
            placeholder: tag,
            type: 'self_reference',
            message: `Step ${stepIndex + 1} cannot reference itself via {{${tag}}}.`
          });
        } else if (targetNum > stepIndex + 1) {
          errors.push({
            stepIndex,
            stepId: step.id || `step_${stepIndex + 1}`,
            placeholder: tag,
            type: 'forward_reference',
            message: `Forward reference detected: Step ${stepIndex + 1} references future Step ${targetNum}.`
          });
        }
        return;
      }

      // 4. Check stable ID reference: {{step:step_id}}
      const idMatch = tag.match(/^step:([a-zA-Z0-9_-]+)$/);
      if (idMatch) {
        const targetId = idMatch[1];
        if (!stepIdMap.has(targetId)) {
          errors.push({
            stepIndex,
            stepId: step.id || `step_${stepIndex + 1}`,
            placeholder: tag,
            type: 'missing_step',
            message: `Step references non-existent step ID "{{${tag}}}".`
          });
        } else {
          const targetIndex = stepIdMap.get(targetId);
          if (targetIndex === stepIndex) {
            errors.push({
              stepIndex,
              stepId: step.id || `step_${stepIndex + 1}`,
              placeholder: tag,
              type: 'self_reference',
              message: `Step ${stepIndex + 1} cannot reference itself via {{${tag}}}.`
            });
          } else if (targetIndex > stepIndex) {
            errors.push({
              stepIndex,
              stepId: step.id || `step_${stepIndex + 1}`,
              placeholder: tag,
              type: 'forward_reference',
              message: `Forward reference detected: Step ${stepIndex + 1} references downstream Step ${targetIndex + 1} (${targetId}).`
            });
          }
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Computes which step outputs in a workflow are invalidated when steps are modified or reordered.
 * @param {Object} params
 * @param {Array<Object>} params.oldSteps
 * @param {Array<Object>} params.newSteps
 * @param {Array<Object>} [params.currentResults]
 * @returns {{ hasInvalidations: boolean, invalidatedIndices: number[], invalidatedStepIds: string[], reasons: Object }}
 */
export function computeInvalidatedSteps({ oldSteps = [], newSteps = [], currentResults = [] } = {}) {
  const invalidatedIndices = new Set();
  const invalidatedStepIds = new Set();
  const reasons = {};

  if (!Array.isArray(oldSteps) || !Array.isArray(newSteps)) {
    return { hasInvalidations: false, invalidatedIndices: [], invalidatedStepIds: [], reasons: {} };
  }

  // Map old steps by ID and by index
  const oldStepMap = new Map();
  oldSteps.forEach((s, idx) => {
    if (s && s.id) oldStepMap.set(s.id, { step: s, index: idx });
  });

  // Track which IDs were directly modified or shifted
  const directlyDirtyIds = new Set();

  newSteps.forEach((newStep, newIdx) => {
    if (!newStep) return;
    const oldEntry = oldStepMap.get(newStep.id);

    if (!oldEntry) {
      // Brand new step added
      directlyDirtyIds.add(newStep.id);
      reasons[newStep.id] = 'New step added to pipeline';
    } else {
      const oldStep = oldEntry.step;
      const oldIdx = oldEntry.index;

      if (oldIdx !== newIdx) {
        // Step was reordered
        directlyDirtyIds.add(newStep.id);
        reasons[newStep.id] = `Step moved from position ${oldIdx + 1} to ${newIdx + 1}`;
      } else if (
        oldStep.instruction !== newStep.instruction ||
        oldStep.title !== newStep.title ||
        oldStep.provider !== newStep.provider ||
        oldStep.model !== newStep.model ||
        oldStep.contextProfileId !== newStep.contextProfileId
      ) {
        directlyDirtyIds.add(newStep.id);
        reasons[newStep.id] = 'Step configuration or instruction modified';
      }
    }
  });

  // Propagate dirty status downstream to any step that depends on a dirty step
  // Either via {{prev}} from preceding step, or via {{stepN}}, or {{step:id}}
  const allDirtyIds = new Set(directlyDirtyIds);

  let propagated = true;
  while (propagated) {
    propagated = false;
    newSteps.forEach((step, idx) => {
      if (!step || allDirtyIds.has(step.id)) return;

      const placeholders = extractPlaceholders(step.instruction || '');
      let dependsOnDirty = false;
      let dirtyReason = '';

      // Check {{prev}} or {{previous}}
      const hasPrevRef = placeholders.some(p => {
        const lp = (p || '').toLowerCase();
        return lp === 'prev' || lp === 'previous';
      });
      if (hasPrevRef && idx > 0) {
        const prevStep = newSteps[idx - 1];
        if (prevStep && allDirtyIds.has(prevStep.id)) {
          dependsOnDirty = true;
          dirtyReason = `Previous step (${prevStep.title || prevStep.id}) was modified`;
        }
      }

      // Check {{stepN}}
      if (!dependsOnDirty) {
        placeholders.forEach(tag => {
          const match = tag.match(/^step(\d+)$/i);
          if (match) {
            const targetNum = parseInt(match[1], 10);
            const targetStep = newSteps[targetNum - 1];
            if (targetStep && allDirtyIds.has(targetStep.id)) {
              dependsOnDirty = true;
              dirtyReason = `Preceding step ${targetNum} (${targetStep.title || targetStep.id}) was modified`;
            }
          }
        });
      }

      // Check {{step:id}}
      if (!dependsOnDirty) {
        placeholders.forEach(tag => {
          const match = tag.match(/^step:([a-zA-Z0-9_-]+)$/);
          if (match) {
            const targetId = match[1];
            if (allDirtyIds.has(targetId)) {
              dependsOnDirty = true;
              dirtyReason = `Referenced step ${targetId} was modified`;
            }
          }
        });
      }

      if (dependsOnDirty) {
        allDirtyIds.add(step.id);
        reasons[step.id] = dirtyReason;
        propagated = true;
      }
    });
  }

  // Populate output arrays
  newSteps.forEach((step, idx) => {
    if (step && allDirtyIds.has(step.id)) {
      invalidatedIndices.add(idx);
      invalidatedStepIds.add(step.id);
    }
  });

  return {
    hasInvalidations: allDirtyIds.size > 0,
    invalidatedIndices: Array.from(invalidatedIndices),
    invalidatedStepIds: Array.from(invalidatedStepIds),
    reasons
  };
}

/**
 * Validates advanced execution parameters (temperature & maxTokens) across steps.
 * @param {Array<Object>} steps
 * @returns {{ isValid: boolean, errors: Array<{ stepIndex: number, stepId: string, param: string, value: any, message: string }> }}
 */
export function validateStepParameters(steps = []) {
  if (!Array.isArray(steps)) return { isValid: true, errors: [] };

  const errors = [];
  steps.forEach((step, idx) => {
    if (!step) return;

    if (step.temperature !== undefined && step.temperature !== 'inherit') {
      const temp = parseFloat(step.temperature);
      if (isNaN(temp) || temp < 0 || temp > 2.0) {
        errors.push({
          stepIndex: idx,
          stepId: step.id,
          param: 'temperature',
          value: step.temperature,
          message: `Step ${idx + 1} temperature must be between 0.0 and 2.0 (got ${step.temperature}).`
        });
      }
    }

    if (step.maxTokens !== undefined && step.maxTokens !== 'inherit') {
      const tokens = parseInt(step.maxTokens, 10);
      if (isNaN(tokens) || tokens < 256 || tokens > 65536) {
        errors.push({
          stepIndex: idx,
          stepId: step.id,
          param: 'maxTokens',
          value: step.maxTokens,
          message: `Step ${idx + 1} maxTokens must be between 256 and 65,536 (got ${step.maxTokens}).`
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates context profile references against available user profiles.
 * @param {Object} flow
 * @param {Array<Object>} availableProfiles
 * @returns {{ isValid: boolean, warnings: Array<{ stepIndex?: number, stepId?: string, profileId: string, message: string }> }}
 */
export function validateContextProfiles(flow = {}, availableProfiles = []) {
  const warnings = [];
  const knownProfileIds = new Set((availableProfiles || []).map(p => p.id));

  // 1. Check default context profile on workflow
  if (flow.defaultContextProfileId && flow.defaultContextProfileId !== 'none' && flow.defaultContextProfileId !== '') {
    if (!knownProfileIds.has(flow.defaultContextProfileId)) {
      warnings.push({
        profileId: flow.defaultContextProfileId,
        message: `Workflow default context profile "${flow.defaultContextProfileId}" was deleted or does not exist.`
      });
    }
  }

  // 2. Check each step profile
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  steps.forEach((step, idx) => {
    if (!step) return;
    const profId = step.contextProfileId;
    if (profId && profId !== 'inherit' && profId !== 'none' && profId !== '') {
      if (!knownProfileIds.has(profId)) {
        warnings.push({
          stepIndex: idx,
          stepId: step.id,
          profileId: profId,
          message: `Step ${idx + 1} references context profile "${profId}" which was deleted or does not exist.`
        });
      }
    }
  });

  return {
    isValid: warnings.length === 0,
    warnings
  };
}

/**
 * Validates provider credentials across steps to detect missing API keys before running.
 * @param {Object} flow
 * @param {Object} activeConfig
 * @param {Record<string, Object>} savedProfiles
 * @returns {{ allReady: boolean, missing: Array<{ stepIndex: number, stepId: string, provider: string, message: string }> }}
 */
export function validateProviderCredentials(flow = {}, activeConfig = {}, savedProfiles = {}) {
  const missing = [];
  const steps = Array.isArray(flow.steps) ? flow.steps : [];

  steps.forEach((step, idx) => {
    if (!step) return;
    const isInherit = !step.provider || step.provider === 'inherit';
    const provider = isInherit ? (activeConfig.provider || 'openrouter') : step.provider;

    // Keyless providers need no check
    if (provider === 'ninerouter' || provider === 'custom') {
      return;
    }

    const key = isInherit
      ? (activeConfig.apiKey || '').trim()
      : ((savedProfiles && savedProfiles[provider]?.apiKey) || '').trim();

    if (!key) {
      missing.push({
        stepIndex: idx,
        stepId: step.id,
        provider,
        message: `Missing API Key for provider "${provider}" on Step ${idx + 1} ("${step.title || 'Untitled'}").`
      });
    }
  });

  return {
    allReady: missing.length === 0,
    missing
  };
}
