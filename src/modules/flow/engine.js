/**
 * Pecut AI — Workflow Execution Engine (Pecut Flow 2.0)
 * Apache-2.0 License
 *
 * Orchestrates multi-step, multi-model asynchronous pipeline runs:
 * - Deterministic variable chaining via `interpolation.js`
 * - Per-step provider & model credential resolution
 * - Context Profile persona injection
 * - Real-time progress telemetry & callbacks
 * - Strict error surfacing (NO silent mock fallback)
 * - AbortSignal cancellation & resume from step k
 */

import { completeChat } from '../../services/ai/transport.js';
import { interpolateStepPrompt } from './interpolation.js';
import { PROVIDER_PRESETS } from '../../data/models.js';

/**
 * Resolves execution credentials and options for a step based on inherit vs explicit override.
 * @param {Object} step
 * @param {Object} activeConfig
 * @param {Record<string, Object>} savedProfiles
 * @returns {Object}
 */
export function resolveStepExecutionConfig(step = {}, activeConfig = {}, savedProfiles = {}) {
  const isInheritProvider = !step.provider || step.provider === 'inherit';
  const provider = isInheritProvider ? (activeConfig.provider || 'openrouter') : step.provider;

  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openrouter;
  const profile = (savedProfiles && savedProfiles[provider]) || {};

  let apiKey = isInheritProvider
    ? (activeConfig.apiKey || '').trim()
    : (profile.apiKey || '').trim();

  let baseUrl = isInheritProvider
    ? (activeConfig.baseUrl || preset.baseUrl).trim()
    : (profile.baseUrl || preset.baseUrl).trim();

  let model = '';
  if (isInheritProvider) {
    model = (!step.model || step.model === 'inherit')
      ? (activeConfig.model || preset.defaultModel)
      : step.model;
  } else {
    model = (!step.model || step.model === 'inherit')
      ? (profile.model || preset.defaultModel)
      : step.model;
  }

  const tempNum = parseFloat(step.temperature);
  const temperature = !isNaN(tempNum) && tempNum >= 0 && tempNum <= 2 ? tempNum : 0.3;

  const maxTokensNum = parseInt(step.maxTokens, 10);
  const maxTokens = !isNaN(maxTokensNum) && maxTokensNum >= 256 && maxTokensNum <= 65536 ? maxTokensNum : 4096;

  const isKeyless = provider === 'ninerouter' || provider === 'custom';
  const hasCredential = isKeyless || Boolean(apiKey && apiKey.length > 0);

  return {
    provider,
    model,
    apiKey,
    baseUrl,
    temperature,
    maxTokens,
    isKeyless,
    hasCredential
  };
}

/**
 * Formats a persona prompt from a Context Profile if assigned.
 * @param {string} stepProfileId
 * @param {string} flowDefaultProfileId
 * @param {Array<Object>} allProfiles
 * @returns {string}
 */
export function resolveContextProfilePrompt(stepProfileId, flowDefaultProfileId, allProfiles = []) {
  if (stepProfileId === 'none') {
    return '';
  }

  const effectiveId = (stepProfileId && stepProfileId !== 'inherit')
    ? stepProfileId
    : flowDefaultProfileId;

  if (!effectiveId) return '';

  const found = Array.isArray(allProfiles) ? allProfiles.find(p => p.id === effectiveId) : null;
  if (!found) return '';

  const parts = [];
  if (found.role) parts.push(`Role / Persona: ${found.role}`);
  if (found.tone) parts.push(`Tone: ${found.tone}`);
  if (found.context) parts.push(`Background Context: ${found.context}`);
  if (found.constraints) parts.push(`Strict Rules & Constraints: ${found.constraints}`);

  return parts.length > 0 ? parts.join('\n') : '';
}

/**
 * Executes a full or resumed pipeline flow sekuensial.
 * @param {Object} options
 * @param {Object} options.flow
 * @param {string} options.input
 * @param {number} [options.startIndex=0]
 * @param {Array<Object>} [options.initialStepOutputs=[]]
 * @param {AbortSignal} [options.signal]
 * @param {Object} [options.activeConfig]
 * @param {Record<string, Object>} [options.savedProfiles]
 * @param {Array<Object>} [options.allProfiles]
 * @param {Function} [options.transportFn=completeChat]
 * @param {Object} [options.callbacks]
 * @param {(info: Object) => void} [options.callbacks.onStepStart]
 * @param {(res: Object) => void} [options.callbacks.onStepSuccess]
 * @param {(err: Object) => void} [options.callbacks.onStepError]
 * @returns {Promise<{ success: boolean, flowId: string, totalDurationMs: number, results: Array<Object> }>}
 */
export async function executeWorkflowPipeline(options = {}) {
  const {
    flow,
    input,
    startIndex = 0,
    initialStepOutputs = [],
    singleStepOnly = false,
    signal,
    activeConfig = {},
    savedProfiles = {},
    allProfiles = [],
    transportFn = completeChat,
    callbacks = {}
  } = options;

  if (!flow || !Array.isArray(flow.steps) || flow.steps.length === 0) {
    throw new Error('Invalid workflow: no steps defined.');
  }

  const rootInput = (typeof input === 'string' ? input : '').trim();
  if (!rootInput) {
    throw new Error('Workflow input data is required.');
  }

  const runStartTime = Date.now();
  const results = Array.isArray(initialStepOutputs) ? [...initialStepOutputs] : [];

  // Re-build sequential stepOutputs array and stepMap from prior outputs
  const stepOutputs = results.map(r => r.output || '');
  const stepMap = {};
  results.forEach(r => {
    if (r.stepId) stepMap[r.stepId] = r.output || '';
  });

  let previousOutput = results.length > 0 ? results[results.length - 1].output : '';

  for (let i = startIndex; i < flow.steps.length; i++) {
    // 1. Check cancellation before starting next step
    if (signal && signal.aborted) {
      const abortErr = new DOMException('Workflow pipeline cancelled by user.', 'AbortError');
      abortErr.partialResults = results;
      abortErr.failedStepIndex = i;
      throw abortErr;
    }

    const step = flow.steps[i];
    const stepConfig = resolveStepExecutionConfig(step, activeConfig, savedProfiles);
    const personaPrompt = resolveContextProfilePrompt(step.contextProfileId, flow.defaultContextProfileId, allProfiles);

    // 2. Validate provider credentials (no silent fallback)
    if (!stepConfig.hasCredential) {
      const credErr = new Error(`Missing API Key for provider "${stepConfig.provider}" at Step ${i + 1} ("${step.title}"). Please configure credentials in AI Settings.`);
      credErr.partialResults = results;
      credErr.failedStepIndex = i;
      if (typeof callbacks.onStepError === 'function') {
        callbacks.onStepError({ stepIndex: i, stepId: step.id, error: credErr });
      }
      throw credErr;
    }

    // 3. Interpolate variables into prompt
    const interpResult = interpolateStepPrompt(step.instruction, {
      input: rootInput,
      prev: previousOutput,
      stepOutputs,
      stepMap,
      stepIndex: i
    });

    const stepInfo = {
      stepIndex: i,
      stepId: step.id,
      stepTitle: step.title,
      provider: stepConfig.provider,
      model: stepConfig.model,
      temperature: stepConfig.temperature,
      maxTokens: stepConfig.maxTokens,
      interpolatedPrompt: interpResult.prompt,
      autoAppended: interpResult.autoAppended,
      usedPlaceholders: interpResult.usedPlaceholders
    };

    if (typeof callbacks.onStepStart === 'function') {
      callbacks.onStepStart(stepInfo);
    }

    // 3. Assemble system prompt
    let systemPrompt = `You are Pecut AI Workflow Engine executing Step ${i + 1}: "${step.title}".
Deliver a clean, authoritative, structured output directly fulfilling the instructions. Avoid meta-commentary or conversational filler.`;

    if (personaPrompt) {
      systemPrompt += `\n\n[Active Persona Directives]\n${personaPrompt}`;
    }

    const stepStartTime = Date.now();
    try {
      const response = await transportFn({
        overrideConfig: stepConfig,
        systemPrompt,
        messages: [{ role: 'user', content: interpResult.prompt }],
        temperature: stepConfig.temperature,
        maxTokens: stepConfig.maxTokens,
        signal
      });

      const latencyMs = Date.now() - stepStartTime;
      const stepOutput = (response && typeof response.text === 'string') ? response.text.trim() : '';

      const stepRecord = {
        stepIndex: i,
        stepId: step.id,
        title: step.title,
        output: stepOutput,
        reasoning: response.reasoning || '',
        provider: response.provider || stepConfig.provider,
        model: response.model || stepConfig.model,
        latencyMs,
        usage: response.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        completedAt: new Date().toISOString()
      };

      if (i < results.length) {
        results[i] = stepRecord;
        stepOutputs[i] = stepOutput;
      } else {
        results.push(stepRecord);
        stepOutputs.push(stepOutput);
      }
      stepMap[step.id] = stepOutput;
      previousOutput = stepOutput;

      if (typeof callbacks.onStepSuccess === 'function') {
        callbacks.onStepSuccess(stepRecord);
      }

      if (singleStepOnly) {
        break;
      }
    } catch (err) {
      if (typeof callbacks.onStepError === 'function') {
        callbacks.onStepError({
          stepIndex: i,
          stepId: step.id,
          stepTitle: step.title,
          error: err
        });
      }

      // Strict error surfacing: attach partial results so user can resume / retry
      err.partialResults = results;
      err.failedStepIndex = i;
      err.failedStepId = step.id;
      throw err;
    }
  }

  const totalDurationMs = Date.now() - runStartTime;
  return {
    success: true,
    flowId: flow.id,
    totalDurationMs,
    results
  };
}
