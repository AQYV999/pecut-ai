/**
 * Pecut AI — Workflow Run History & State Recovery Storage (Pecut Flow 2.0)
 * Apache-2.0 License
 *
 * Persists execution runs with snapshotting, quota-safe output bounds, and pruning:
 * - Workflow snapshot per run (historical fidelity)
 * - Maximum 20 runs limit
 * - Per-step output character bound (MAX_RUN_OUTPUT_CHARS = 30,000)
 * - Graceful QuotaExceededError recovery
 */

export const RUNS_STORAGE_KEY = 'pecut_flow_runs';
export const MAX_FLOW_RUNS = 20;
export const MAX_RUN_OUTPUT_CHARS = 30000; // Per-step bound
export const MAX_TOTAL_RUN_OUTPUT_CHARS = 100000; // Total run output budget across all steps
export const MAX_RUNS_STORAGE_BYTES = 1048576; // 1MB overall runs storage budget cap

/**
 * Creates an immutable, clean snapshot of a workflow configuration.
 * @param {Object} flow
 * @returns {Object}
 */
export function createRunSnapshot(flow = {}) {
  const rawSteps = Array.isArray(flow.steps) ? flow.steps : [];
  return {
    id: flow.id || '',
    title: flow.title || 'Untitled Workflow',
    category: flow.category || 'General',
    description: flow.description || '',
    defaultContextProfileId: flow.defaultContextProfileId || '',
    steps: rawSteps.map((s, idx) => ({
      id: s.id || `step_${idx + 1}`,
      title: s.title || `Step ${idx + 1}`,
      instruction: s.instruction || '',
      provider: s.provider || 'inherit',
      model: s.model || 'inherit',
      contextProfileId: s.contextProfileId || 'inherit',
      temperature: s.temperature ?? 0.3,
      maxTokens: s.maxTokens ?? 4096
    }))
  };
}

/**
 * Truncates massive output strings to prevent blowing localStorage budgets.
 * @param {string} text
 * @returns {string}
 */
function truncateOutputIfNeeded(text) {
  if (typeof text !== 'string') return '';
  if (text.length <= MAX_RUN_OUTPUT_CHARS) return text;
  return text.slice(0, MAX_RUN_OUTPUT_CHARS) + '\n\n... [Output truncated for storage budget]';
}

/**
 * Loads all recorded flow runs from localStorage, sorted newest first.
 * @returns {Array<Object>}
 */
export function loadFlowRuns() {
  try {
    const raw = localStorage.getItem(RUNS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
      }
    }
  } catch (_) {}
  return [];
}

/**
 * Persists an array of runs directly to localStorage with quota safety and size bounding.
 * @param {Array<Object>} runs
 */
function persistRunsInternal(runs) {
  let bounded = runs.slice(0, MAX_FLOW_RUNS);

  // Enforce overall storage bytes cap by pruning older runs if needed
  try {
    let serialized = JSON.stringify(bounded);
    while (serialized.length > MAX_RUNS_STORAGE_BYTES && bounded.length > 1) {
      bounded.pop();
      serialized = JSON.stringify(bounded);
    }
    localStorage.setItem(RUNS_STORAGE_KEY, serialized);
  } catch (err) {
    // If QuotaExceededError, aggressively prune older runs and retry
    while (bounded.length > 1) {
      bounded = bounded.slice(0, Math.max(1, Math.floor(bounded.length / 2)));
      try {
        localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(bounded));
        break;
      } catch (_) {}
    }
  }
}

/**
 * Retrieves a single flow run by ID.
 * @param {string} runId
 * @returns {Object|null}
 */
export function getFlowRunById(runId) {
  const runs = loadFlowRuns();
  return runs.find(r => r.id === runId) || null;
}

/**
 * Retrieves the most recent execution run for a given workflow.
 * @param {string} flowId
 * @returns {Object|null}
 */
export function getLatestRunForFlow(flowId) {
  const runs = loadFlowRuns();
  return runs.find(r => r.flowId === flowId) || null;
}

/**
 * Saves or updates a flow execution run record.
 * @param {Object} runData
 * @returns {Object}
 */
export function saveFlowRun(runData = {}) {
  const runs = loadFlowRuns();
  const id = runData.id || ('run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));

  // Bound each step output string
  let boundedStepResults = Array.isArray(runData.stepResults)
    ? runData.stepResults.map(step => ({
        ...step,
        output: truncateOutputIfNeeded(step.output || ''),
        reasoning: truncateOutputIfNeeded(step.reasoning || '')
      }))
    : [];

  // Enforce total run output budget across all steps
  let totalChars = boundedStepResults.reduce(
    (acc, s) => acc + (s.output ? s.output.length : 0) + (s.reasoning ? s.reasoning.length : 0),
    0
  );

  if (totalChars > MAX_TOTAL_RUN_OUTPUT_CHARS) {
    let remainingBudget = MAX_TOTAL_RUN_OUTPUT_CHARS;
    boundedStepResults = boundedStepResults.map(s => {
      const outLen = s.output ? s.output.length : 0;
      const rsnLen = s.reasoning ? s.reasoning.length : 0;
      if (outLen + rsnLen <= remainingBudget) {
        remainingBudget -= (outLen + rsnLen);
        return s;
      }
      let newOut = s.output || '';
      let newRsn = s.reasoning || '';
      if (remainingBudget <= 0) {
        newOut = '... [Output omitted for total run storage budget]';
        newRsn = '';
      } else if (newOut.length > remainingBudget) {
        newOut = newOut.slice(0, Math.max(0, remainingBudget - 50)) + '\n... [Truncated for total run budget]';
        newRsn = '';
        remainingBudget = 0;
      } else {
        remainingBudget -= newOut.length;
        newRsn = newRsn.slice(0, Math.max(0, remainingBudget - 50)) + '\n... [Truncated for total run budget]';
        remainingBudget = 0;
      }
      return { ...s, output: newOut, reasoning: newRsn };
    });
  }

  const normalizedRun = {
    id,
    flowId: runData.flowId || '',
    flowTitle: runData.flowTitle || 'Workflow',
    status: runData.status || 'completed', // 'completed' | 'failed' | 'cancelled' | 'running'
    input: typeof runData.input === 'string' ? runData.input : '',
    startedAt: runData.startedAt || new Date().toISOString(),
    completedAt: runData.completedAt || new Date().toISOString(),
    totalDurationMs: runData.totalDurationMs || 0,
    flowSnapshot: runData.flowSnapshot ? createRunSnapshot(runData.flowSnapshot) : null,
    stepResults: boundedStepResults,
    error: runData.error || null
  };

  const existingIdx = runs.findIndex(r => r.id === id);
  if (existingIdx !== -1) {
    runs[existingIdx] = normalizedRun;
  } else {
    runs.unshift(normalizedRun);
  }

  persistRunsInternal(runs);
  return normalizedRun;
}

/**
 * Deletes a flow run by ID.
 * @param {string} runId
 * @returns {boolean}
 */
export function deleteFlowRun(runId) {
  const runs = loadFlowRuns();
  const filtered = runs.filter(r => r.id !== runId);
  if (filtered.length !== runs.length) {
    persistRunsInternal(filtered);
    return true;
  }
  return false;
}

/**
 * Clears all flow execution runs from storage.
 */
export function clearFlowRuns() {
  localStorage.removeItem(RUNS_STORAGE_KEY);
}
