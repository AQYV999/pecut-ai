/**
 * Pecut AI — Workflow Chaining Engine & Workbench (Pecut Flow 2.0)
 * Apache-2.0 License
 */

import {
  loadFlows,
  saveFlow,
  createFlow,
  deleteFlow,
  duplicateFlow,
  getFlowById,
  exportFlowsJSON,
  importFlowsJSON,
  generateStepId,
  validateFlowV2,
  validateStepReferences,
  computeInvalidatedSteps,
  validateStepParameters,
  validateContextProfiles,
  validateProviderCredentials,
  createRunSnapshot,
  saveFlowRun,
  loadFlowRuns,
  getFlowRunById,
  clearFlowRuns,
  getLatestRunForFlow,
  executeWorkflowPipeline
} from './flow/index.js';
import { PROVIDER_PRESETS } from '../data/models.js';
import { logHistory } from './history.js';
import { switchView, registerViewHandler } from './navigation.js';
import { escapeHtml, showToast } from '../utils/helpers.js';
import { formatRichMarkdown } from '../utils/markdown.js';
import { applyContentToDocument } from './canvas/editor.js';
import { appState, saveState, loadBYOKConfig, loadProviderProfiles } from './storage.js';

let allFlows = [];
let activeFlow = null;
let currentMode = 'run'; // 'run' | 'edit'
let flowResults = [];
let invalidatedStepIds = new Set();
let lastRunStepsSnapshot = null;
let openAdvancedStepIndices = new Set();
let outputViewMode = 'rendered'; // 'rendered' | 'raw'
let activeResultTabIndex = -1;

// Execution State Machine
// States: 'idle' | 'validating' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled'
let executionState = 'idle';
let currentAbortController = null;
let executionTimerInterval = null;
let executionStartTime = 0;
let totalTokensAccumulated = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
let currentRunRecord = null;
let lastFailedStepIndex = null;

/**
 * Loads workflows and initializes the active flow pointer.
 */
function refreshFlowData() {
  allFlows = loadFlows();
  if (!activeFlow || !allFlows.some(f => f.id === activeFlow.id)) {
    activeFlow = allFlows[0] || null;
  } else {
    activeFlow = allFlows.find(f => f.id === activeFlow.id) || allFlows[0];
  }
}

/**
 * Updates the execution state machine and reflects state in telemetry UI.
 * @param {'idle'|'validating'|'running'|'cancelling'|'completed'|'failed'|'cancelled'} state
 * @param {Object} [meta]
 */
export function setExecutionState(state, meta = {}) {
  executionState = state;

  const panel = document.getElementById('flowTelemetryPanel');
  const badge = document.getElementById('telemetryStateBadge');
  const label = document.getElementById('telemetryProgressLabel');
  const fill = document.getElementById('telemetryProgressFill');
  const errBox = document.getElementById('telemetryErrorAlert');
  const errMsg = document.getElementById('telemetryErrorMessage');

  const btnCancel = document.getElementById('btnCancelFlowExecution');
  const btnRetry = document.getElementById('btnRetryFailedStep');
  const btnResume = document.getElementById('btnResumePipeline');
  const btnReset = document.getElementById('btnResetFlowRun');
  const runBtn = document.getElementById('runFlowPipelineBtn');

  if (!panel || !badge) return;

  if (state === 'idle') {
    panel.style.display = 'none';
    if (runBtn) runBtn.disabled = false;
    return;
  }

  panel.style.display = 'flex';
  badge.textContent = state.toUpperCase();
  badge.className = `telemetry-state-badge state-${state}`;

  if (meta.label && label) label.textContent = meta.label;

  // Handle Error Alert
  if (state === 'failed' && meta.error) {
    if (errBox) errBox.style.display = 'flex';
    if (errMsg) errMsg.textContent = meta.error;
    if (fill) fill.className = 'telemetry-progress-fill failed';
  } else {
    if (errBox) errBox.style.display = 'none';
    if (fill) {
      fill.className = `telemetry-progress-fill ${state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : ''}`;
    }
  }

  // Handle Action Controls
  if (btnCancel) {
    btnCancel.style.display = (state === 'running' || state === 'cancelling') ? 'inline-flex' : 'none';
    btnCancel.disabled = (state === 'cancelling');
    btnCancel.innerHTML = state === 'cancelling'
      ? `<svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Cancelling...`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/></svg> Cancel Execution`;
  }

  if (btnRetry) {
    btnRetry.style.display = state === 'failed' ? 'inline-flex' : 'none';
    const targetIdx = typeof meta.failedIndex === 'number' ? meta.failedIndex : lastFailedStepIndex;
    if (typeof targetIdx === 'number') {
      btnRetry.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Retry Step ${targetIdx + 1}
      `;
    }
  }

  if (btnResume) {
    btnResume.style.display = (state === 'failed' || state === 'cancelled') ? 'inline-flex' : 'none';
  }

  if (btnReset) {
    btnReset.style.display = (state === 'completed' || state === 'failed' || state === 'cancelled') ? 'inline-flex' : 'none';
  }

  if (runBtn) {
    runBtn.disabled = (state === 'running' || state === 'cancelling' || state === 'validating');
  }
}

/**
 * Starts execution duration timer.
 */
function startTelemetryTimer() {
  stopTelemetryTimer();
  executionStartTime = Date.now();
  const timerEl = document.getElementById('telemetryTimer');
  if (timerEl) timerEl.textContent = '⏱ 00:00.0s';

  executionTimerInterval = setInterval(() => {
    const elapsedMs = Date.now() - executionStartTime;
    const totalSecs = Math.floor(elapsedMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const tenths = Math.floor((elapsedMs % 1000) / 100);
    const formatted = `⏱ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}s`;
    const tEl = document.getElementById('telemetryTimer');
    if (tEl) tEl.textContent = formatted;
  }, 100);
}

/**
 * Stops and cleans up execution duration timer.
 */
function stopTelemetryTimer() {
  if (executionTimerInterval) {
    clearInterval(executionTimerInterval);
    executionTimerInterval = null;
  }
}

/**
 * Updates visual status and badges for a specific step node in the visualizer.
 * @param {number} index
 * @param {'ready'|'running'|'completed'|'failed'|'cancelled'} status
 * @param {Object} [meta]
 */
function updateStepNodeStatus(index, status, meta = {}) {
  const nodeEl = document.getElementById(`step-node-${index}`);
  const statusEl = document.getElementById(`step-status-${index}`);
  if (!nodeEl || !statusEl) return;

  nodeEl.classList.remove('running', 'completed', 'failed', 'cancelled');

  if (status === 'running') {
    nodeEl.classList.add('running');
    statusEl.innerHTML = `
      <span class="status-indicator running">
        <svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Processing...
      </span>
    `;
  } else if (status === 'completed') {
    nodeEl.classList.add('completed');
    const latencySec = (meta.latencyMs ? (meta.latencyMs / 1000).toFixed(1) + 's' : '');
    const tokens = (meta.usage?.totalTokens ? meta.usage.totalTokens + ' tok' : '');
    const extra = [latencySec, tokens].filter(Boolean).join(' • ');
    statusEl.innerHTML = `
      <span class="status-indicator done">
        ✓ Done ${extra ? `(${escapeHtml(extra)})` : ''}
      </span>
    `;
  } else if (status === 'failed') {
    nodeEl.classList.add('failed');
    statusEl.innerHTML = `
      <span class="status-indicator failed">
        ✕ Failed
      </span>
    `;
  } else if (status === 'cancelled') {
    nodeEl.classList.add('cancelled');
    statusEl.innerHTML = `
      <span class="status-indicator cancelled">
        ⊘ Cancelled
      </span>
    `;
  } else {
    statusEl.innerHTML = `<span class="status-indicator">Ready</span>`;
  }
}

/**
 * Renders the flow selector list in the left sidebar.
 */
export function renderFlowList() {
  const container = document.getElementById('flowSelectorList');
  if (!container) return;

  refreshFlowData();

  const searchInput = document.getElementById('flowSearchInput');
  const query = (searchInput?.value || '').trim().toLowerCase();

  const filtered = allFlows.filter(f => {
    if (!query) return true;
    return (
      f.title.toLowerCase().includes(query) ||
      (f.description && f.description.toLowerCase().includes(query)) ||
      (f.category && f.category.toLowerCase().includes(query))
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding: 1rem; color: var(--text-tertiary); font-size: 0.82rem; text-align: center;">No matching workflows found.</div>';
    return;
  }

  container.innerHTML = filtered.map(f => {
    const isActive = activeFlow && f.id === activeFlow.id;
    return `
      <div class="flow-picker-card ${isActive ? 'active' : ''}" onclick="window.selectFlow('${f.id}')">
        <div class="flow-picker-header">
          <span class="badge-cat">${escapeHtml(f.category || 'General')}</span>
          <span class="step-count-badge">${f.steps.length} Steps</span>
        </div>
        <h4>${escapeHtml(f.title)}</h4>
        <p>${escapeHtml(f.description || '')}</p>
        <div class="flow-card-actions" onclick="event.stopPropagation()">
          <button type="button" class="btn-icon" title="Duplicate workflow" onclick="window.duplicateActiveFlow('${f.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          ${!f.isBuiltIn ? `
            <button type="button" class="btn-icon" title="Delete workflow" onclick="window.deleteActiveFlow('${f.id}')" style="color: var(--danger, #ef4444);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Selects an active workflow by ID and updates UI.
 * @param {string} flowId
 */
export function selectFlow(flowId) {
  const found = getFlowById(flowId) || allFlows.find(f => f.id === flowId);
  if (!found) return;

  activeFlow = found;
  flowResults = [];
  invalidatedStepIds.clear();
  lastRunStepsSnapshot = null;
  openAdvancedStepIndices.clear();
  currentRunRecord = null;
  lastFailedStepIndex = null;
  setExecutionState('idle');

  renderFlowList();
  if (currentMode === 'edit') {
    renderFlowBuilder();
  } else {
    renderActiveFlowView();
  }
}

/**
 * Toggles between 'run' and 'edit' mode.
 * @param {'run'|'edit'} mode
 */
export function setFlowMode(mode) {
  currentMode = mode;
  const tabRun = document.getElementById('flowTabRun');
  const tabEdit = document.getElementById('flowTabEdit');
  const runHeaderSummary = document.getElementById('flowRunHeaderSummary');
  const editHeaderFields = document.getElementById('flowEditHeaderFields');
  const runView = document.getElementById('flowRunView');
  const builderView = document.getElementById('flowBuilderView');

  if (mode === 'edit') {
    tabRun?.classList.remove('active');
    tabEdit?.classList.add('active');
    if (runHeaderSummary) runHeaderSummary.style.display = 'none';
    if (editHeaderFields) editHeaderFields.style.display = 'block';
    if (runView) runView.style.display = 'none';
    if (builderView) builderView.style.display = 'block';

    const titleInput = document.getElementById('flowEditTitle');
    const catInput = document.getElementById('flowEditCategory');
    const descInput = document.getElementById('flowEditDesc');
    const defaultProfSelect = document.getElementById('flowEditDefaultProfile');

    if (titleInput && activeFlow) titleInput.value = activeFlow.title;
    if (catInput && activeFlow) catInput.value = activeFlow.category || 'General';
    if (descInput && activeFlow) descInput.value = activeFlow.description || '';

    if (defaultProfSelect && activeFlow) {
      populateDefaultProfileDropdown(defaultProfSelect, activeFlow.defaultContextProfileId);
    }

    renderFlowBuilder();
  } else {
    tabRun?.classList.add('active');
    tabEdit?.classList.remove('active');
    if (runHeaderSummary) runHeaderSummary.style.display = 'block';
    if (editHeaderFields) editHeaderFields.style.display = 'none';
    if (runView) runView.style.display = 'block';
    if (builderView) builderView.style.display = 'none';

    renderActiveFlowView();
  }
}

/**
 * Populates the default context profile dropdown in the workflow header.
 * @param {HTMLSelectElement} selectEl
 * @param {string} selectedId
 */
function populateDefaultProfileDropdown(selectEl, selectedId = '') {
  if (!selectEl) return;
  const profiles = appState.profiles || [];
  let html = '<option value="">(None - No Default Persona)</option>';

  let foundSelected = false;
  profiles.forEach(p => {
    const isSel = p.id === selectedId;
    if (isSel) foundSelected = true;
    html += `<option value="${p.id}" ${isSel ? 'selected' : ''}>${escapeHtml(p.name)} (${escapeHtml(p.category || 'General')})</option>`;
  });

  if (selectedId && selectedId !== 'none' && !foundSelected) {
    html += `<option value="${escapeHtml(selectedId)}" selected>⚠️ ${escapeHtml(selectedId)} (Deleted Profile)</option>`;
  }

  selectEl.innerHTML = html;
}

/**
 * Renders the active flow in Run Mode.
 */
export function renderActiveFlowView() {
  if (!activeFlow) return;

  const titleEl = document.getElementById('flowActiveTitle');
  const descEl = document.getElementById('flowActiveDesc');
  const catEl = document.getElementById('flowActiveCategory');
  const stepCountEl = document.getElementById('flowActiveStepCount');
  const stepsContainer = document.getElementById('flowStepsVisualizer');
  const resultsContainer = document.getElementById('flowResultsContainer');
  const staleNotice = document.getElementById('flowInvalidationNotice');

  if (titleEl) titleEl.textContent = activeFlow.title;
  if (descEl) descEl.textContent = activeFlow.description || 'Custom multi-step workflow pipeline.';
  if (catEl) catEl.textContent = activeFlow.category || 'General';
  if (stepCountEl) stepCountEl.textContent = `${activeFlow.steps.length} Steps`;

  if (staleNotice) {
    staleNotice.style.display = invalidatedStepIds.size > 0 ? 'flex' : 'none';
  }

  if (stepsContainer) {
    const activeConfig = loadBYOKConfig();

    stepsContainer.innerHTML = activeFlow.steps.map((step, idx) => {
      const isStale = invalidatedStepIds.has(step.id);
      const isInheritProvider = !step.provider || step.provider === 'inherit';
      const provider = isInheritProvider ? (activeConfig.provider || 'openrouter') : step.provider;
      const model = (!step.model || step.model === 'inherit')
        ? (isInheritProvider ? (activeConfig.model || 'default') : (PROVIDER_PRESETS[provider]?.defaultModel || 'default'))
        : step.model;

      return `
        <div class="flow-step-node" id="step-node-${idx}">
          <div class="step-badge">${idx + 1}</div>
          <div class="step-content">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <h5>${escapeHtml(step.title)}</h5>
              <span class="step-id-badge">${escapeHtml(step.id)}</span>
              <span class="step-cred-pill ready" style="font-size: 0.68rem;">${escapeHtml(provider)}: ${escapeHtml(model)}</span>
              ${isStale ? '<span class="flow-stale-pill">Outdated</span>' : ''}
            </div>
            <p>${escapeHtml(step.instruction)}</p>
          </div>
          <div class="step-status" id="step-status-${idx}">
            <span class="status-indicator">Ready</span>
          </div>
        </div>
      `;
    }).join('');
  }

  if (resultsContainer && flowResults.length === 0) {
    resultsContainer.style.display = 'none';
  }

  renderFlowRunHistory();
}

/**
 * Renders the Workflow Builder / Step Editor view.
 */
export function renderFlowBuilder() {
  if (!activeFlow) return;

  const editorContainer = document.getElementById('flowStepsEditor');
  const validationAlert = document.getElementById('flowValidationAlert');
  const validationList = document.getElementById('flowValidationErrorsList');
  const staleNotice = document.getElementById('flowInvalidationNotice');
  const stepCountEl = document.getElementById('flowActiveStepCount');
  const defaultProfSelect = document.getElementById('flowEditDefaultProfile');

  if (stepCountEl) stepCountEl.textContent = `${activeFlow.steps.length} Steps`;

  if (defaultProfSelect) {
    populateDefaultProfileDropdown(defaultProfSelect, activeFlow.defaultContextProfileId);
  }

  const activeConfig = loadBYOKConfig();
  const savedProfiles = loadProviderProfiles();
  const profiles = appState.profiles || [];

  const refValidation = validateStepReferences(activeFlow.steps);
  const paramValidation = validateStepParameters(activeFlow.steps);
  const profValidation = validateContextProfiles(activeFlow, profiles);
  const credValidation = validateProviderCredentials(activeFlow, activeConfig, savedProfiles);

  const allAlerts = [];
  refValidation.errors.forEach(e => allAlerts.push({ type: 'error', message: e.message }));
  paramValidation.errors.forEach(e => allAlerts.push({ type: 'error', message: e.message }));
  profValidation.warnings.forEach(w => allAlerts.push({ type: 'warning', message: `⚠️ ${w.message}` }));
  credValidation.missing.forEach(m => allAlerts.push({ type: 'warning', message: `⚠️ ${m.message}` }));

  if (validationAlert && validationList) {
    if (allAlerts.length > 0) {
      validationAlert.style.display = 'block';
      validationList.innerHTML = allAlerts.map(a => `
        <div class="flow-validation-item" style="${a.type === 'warning' ? 'color: #f59e0b;' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>${escapeHtml(a.message)}</span>
        </div>
      `).join('');
    } else {
      validationAlert.style.display = 'none';
    }
  }

  if (staleNotice) {
    staleNotice.style.display = invalidatedStepIds.size > 0 ? 'flex' : 'none';
  }

  if (!editorContainer) return;

  const defaultProf = profiles.find(p => p.id === activeFlow.defaultContextProfileId);
  const defaultProfName = defaultProf ? defaultProf.name : 'None';

  editorContainer.innerHTML = activeFlow.steps.map((step, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === activeFlow.steps.length - 1;
    const stepRefErrors = refValidation.errors.filter(e => e.stepIndex === idx);
    const stepParamErrors = paramValidation.errors.filter(e => e.stepIndex === idx);
    const isStale = invalidatedStepIds.has(step.id);
    const isAdvancedOpen = openAdvancedStepIndices.has(idx);

    const varChips = [];
    varChips.push({ label: '{{input}}', tag: 'input', desc: 'Original seed input' });
    if (!isFirst) {
      varChips.push({ label: '{{prev}}', tag: 'prev', desc: 'Previous step output' });
    }
    for (let k = 0; k < idx; k++) {
      const preceding = activeFlow.steps[k];
      varChips.push({ label: `{{step${k + 1}}}`, tag: `step${k + 1}`, desc: `Step ${k + 1} output` });
      if (preceding.id) {
        varChips.push({ label: `{{step:${preceding.id}}}`, tag: `step:${preceding.id}`, desc: `Stable ID for ${preceding.title}` });
      }
    }

    const isInheritProvider = !step.provider || step.provider === 'inherit';
    const effectiveProvider = isInheritProvider ? (activeConfig.provider || 'openrouter') : step.provider;
    const isKeyless = effectiveProvider === 'ninerouter' || effectiveProvider === 'custom';
    const resolvedKey = isInheritProvider
      ? (activeConfig.apiKey || '').trim()
      : ((savedProfiles && savedProfiles[effectiveProvider]?.apiKey) || '').trim();
    const hasKey = isKeyless || Boolean(resolvedKey);
    const presetModels = (PROVIDER_PRESETS[effectiveProvider]?.models || []).map(m => m.id);

    return `
      <div class="flow-step-edit-card" id="step-edit-card-${idx}">
        <div class="flow-step-edit-header">
          <div class="flow-step-edit-meta">
            <span class="step-badge" style="width: 24px; height: 24px; font-size: 0.72rem;">${idx + 1}</span>
            <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">Step ${idx + 1}</span>
            <span class="step-id-badge">${escapeHtml(step.id)}</span>
            <span class="step-cred-pill ${hasKey ? (isKeyless ? 'keyless' : 'ready') : 'missing'}">
              ${hasKey ? (isKeyless ? '✓ Local/Keyless' : '✓ Key Ready') : '⚠️ No Key in Settings'}
            </span>
            ${isStale ? '<span class="flow-stale-pill">Results Stale</span>' : ''}
          </div>
          <div class="flow-step-edit-actions">
            <button type="button" class="step-reorder-btn" title="Move Step Up" ${isFirst ? 'disabled' : ''} onclick="window.moveFlowStep(${idx}, -1)">
              ▲
            </button>
            <button type="button" class="step-reorder-btn" title="Move Step Down" ${isLast ? 'disabled' : ''} onclick="window.moveFlowStep(${idx}, 1)">
              ▼
            </button>
            <button type="button" class="btn-icon" title="Duplicate Step" onclick="window.duplicateFlowStep(${idx})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button type="button" class="btn-icon" title="Delete Step" ${activeFlow.steps.length <= 1 ? 'disabled' : ''} onclick="window.deleteFlowStep(${idx})" style="color: var(--danger, #ef4444);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700;">Step Title</label>
          <input type="text" id="step-title-${idx}" value="${escapeHtml(step.title)}" oninput="window.updateStepTitle(${idx}, this.value)" placeholder="e.g. Architectural Breakdown">
        </div>

        <!-- Provider, Model & Persona Configuration Grid -->
        <div class="flow-step-config-grid">
          <div class="flow-step-config-item">
            <label>AI Provider</label>
            <select id="step-provider-${idx}" onchange="window.updateStepProvider(${idx}, this.value)">
              <option value="inherit" ${step.provider === 'inherit' ? 'selected' : ''}>⚡ Inherit BYOK (${activeConfig.provider || 'openrouter'})</option>
              <option value="openrouter" ${step.provider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
              <option value="gemini" ${step.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
              <option value="groq" ${step.provider === 'groq' ? 'selected' : ''}>Groq Cloud</option>
              <option value="openai" ${step.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
              <option value="ninerouter" ${step.provider === 'ninerouter' ? 'selected' : ''}>9Router (Local Gateway)</option>
              <option value="custom" ${step.provider === 'custom' ? 'selected' : ''}>Custom / Local (Ollama)</option>
            </select>
          </div>

          <div class="flow-step-config-item">
            <label>Model</label>
            <select id="step-model-${idx}" onchange="window.updateStepModel(${idx}, this.value)">
              ${isInheritProvider ? `
                <option value="inherit" ${step.model === 'inherit' ? 'selected' : ''}>⚡ Inherit Active Model (${activeConfig.model || 'default'})</option>
              ` : `
                <option value="inherit" ${step.model === 'inherit' ? 'selected' : ''}>⚡ Default (${PROVIDER_PRESETS[effectiveProvider]?.defaultModel || 'default'})</option>
              `}
              ${(PROVIDER_PRESETS[effectiveProvider]?.models || []).map(m => `
                <option value="${m.id}" ${step.model === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>
              `).join('')}
              ${step.model && step.model !== 'inherit' && !presetModels.includes(step.model) ? `
                <option value="${escapeHtml(step.model)}" selected>${escapeHtml(step.model)} (Custom)</option>
              ` : ''}
            </select>
          </div>

          <div class="flow-step-config-item">
            <label>Context Profile (Persona)</label>
            <select id="step-profile-${idx}" onchange="window.updateStepProfile(${idx}, this.value)">
              <option value="inherit" ${step.contextProfileId === 'inherit' ? 'selected' : ''}>⚡ Inherit Workflow (${escapeHtml(defaultProfName)})</option>
              <option value="none" ${step.contextProfileId === 'none' ? 'selected' : ''}>None (No Directives)</option>
              ${profiles.map(p => `
                <option value="${p.id}" ${step.contextProfileId === p.id ? 'selected' : ''}>${escapeHtml(p.name)} (${escapeHtml(p.category || 'General')})</option>
              `).join('')}
              ${step.contextProfileId && step.contextProfileId !== 'inherit' && step.contextProfileId !== 'none' && !profiles.some(p => p.id === step.contextProfileId) ? `
                <option value="${escapeHtml(step.contextProfileId)}" selected>⚠️ ${escapeHtml(step.contextProfileId)} (Deleted)</option>
              ` : ''}
            </select>
          </div>
        </div>

        <div>
          <button type="button" class="flow-advanced-toggle-btn" onclick="window.toggleStepAdvanced(${idx})">
            ⚙️ Advanced Parameters (Temp: ${step.temperature ?? 0.3}, Max Tokens: ${step.maxTokens ?? 4096}) ${isAdvancedOpen ? '▲' : '▼'}
          </button>
          ${isAdvancedOpen ? `
            <div class="flow-advanced-panel">
              <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-tertiary);">
                  Temperature (0.0 - 2.0)
                </label>
                <input type="number" step="0.1" min="0" max="2" value="${step.temperature ?? 0.3}" oninput="window.updateStepTemperature(${idx}, this.value)" style="width: 100%; font-size: 0.8rem; padding: 0.35rem 0.5rem; background: var(--bg-color); border: 1px solid var(--surface-border); border-radius: 4px; color: var(--text-primary);">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-tertiary);">
                  Max Tokens (256 - 65,536)
                </label>
                <input type="number" step="256" min="256" max="65536" value="${step.maxTokens ?? 4096}" oninput="window.updateStepMaxTokens(${idx}, this.value)" style="width: 100%; font-size: 0.8rem; padding: 0.35rem 0.5rem; background: var(--bg-color); border: 1px solid var(--surface-border); border-radius: 4px; color: var(--text-primary);">
              </div>
            </div>
          ` : ''}
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <label style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0;">Prompt Template / Instructions</label>
          </div>

          <div class="var-chips-bar">
            <span class="var-chips-label">Insert:</span>
            ${varChips.map(vc => `
              <button type="button" class="var-chip" title="${escapeHtml(vc.desc)}" onclick="window.insertFlowVariable(${idx}, '${vc.tag}')">
                + ${escapeHtml(vc.label)}
              </button>
            `).join('')}
          </div>

          <textarea id="step-instruction-${idx}" rows="4" style="margin-top: 0.5rem; font-family: var(--font-mono); font-size: 0.84rem; line-height: 1.5;" oninput="window.updateStepInstruction(${idx}, this.value)" placeholder="Enter step instruction. Use variables like {{input}} or {{prev}} to pass context...">${escapeHtml(step.instruction)}</textarea>
        </div>

        ${stepRefErrors.length > 0 || stepParamErrors.length > 0 ? `
          <div style="color: #ef4444; font-size: 0.78rem; display: flex; flex-direction: column; gap: 0.2rem;">
            ${stepRefErrors.map(e => `<span>⚠️ ${escapeHtml(e.message)}</span>`).join('')}
            ${stepParamErrors.map(e => `<span>⚠️ ${escapeHtml(e.message)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Tracks changes to steps and calculates downstream output invalidation.
 * @param {Array<Object>} newSteps
 */
function handleStepsChanged(newSteps) {
  if (lastRunStepsSnapshot && flowResults.length > 0) {
    const inv = computeInvalidatedSteps({
      oldSteps: lastRunStepsSnapshot,
      newSteps: newSteps,
      currentResults: flowResults
    });

    if (inv.hasInvalidations) {
      inv.invalidatedStepIds.forEach(id => invalidatedStepIds.add(id));
    }
  }

  activeFlow.steps = newSteps;
  renderFlowBuilder();
}

/**
 * Updates a step's AI provider while preserving all unrelated attributes.
 * @param {number} index
 * @param {string} provider
 */
export function updateStepProvider(index, provider) {
  if (!activeFlow || !activeFlow.steps[index]) return;
  const step = activeFlow.steps[index];

  step.provider = provider;
  if (provider === 'inherit') {
    step.model = 'inherit';
  } else {
    step.model = PROVIDER_PRESETS[provider]?.defaultModel || 'inherit';
  }

  handleStepsChanged(activeFlow.steps);
}

/**
 * Updates a step's model string.
 * @param {number} index
 * @param {string} model
 */
export function updateStepModel(index, model) {
  if (!activeFlow || !activeFlow.steps[index]) return;
  activeFlow.steps[index].model = model;
  handleStepsChanged(activeFlow.steps);
}

/**
 * Updates a step's context profile ID.
 * @param {number} index
 * @param {string} profileId
 */
export function updateStepProfile(index, profileId) {
  if (!activeFlow || !activeFlow.steps[index]) return;
  activeFlow.steps[index].contextProfileId = profileId;
  handleStepsChanged(activeFlow.steps);
}

/**
 * Updates a step's temperature parameter with validation.
 * @param {number} index
 * @param {string|number} temp
 */
export function updateStepTemperature(index, temp) {
  if (!activeFlow || !activeFlow.steps[index]) return;
  const val = parseFloat(temp);
  activeFlow.steps[index].temperature = !isNaN(val) ? val : 0.3;
}

/**
 * Updates a step's maxTokens parameter with validation.
 * @param {number} index
 * @param {string|number} tokens
 */
export function updateStepMaxTokens(index, tokens) {
  if (!activeFlow || !activeFlow.steps[index]) return;
  const val = parseInt(tokens, 10);
  activeFlow.steps[index].maxTokens = !isNaN(val) ? val : 4096;
}

/**
 * Toggles visibility of advanced parameters for a step card.
 * @param {number} index
 */
export function toggleStepAdvanced(index) {
  if (openAdvancedStepIndices.has(index)) {
    openAdvancedStepIndices.delete(index);
  } else {
    openAdvancedStepIndices.add(index);
  }
  renderFlowBuilder();
}

/**
 * Updates workflow default context profile ID.
 * @param {string} profileId
 */
export function updateFlowDefaultProfile(profileId) {
  if (!activeFlow) return;
  activeFlow.defaultContextProfileId = profileId || '';
  handleStepsChanged(activeFlow.steps);
}

/**
 * Adds a new step to the active workflow.
 */
export function addFlowStep() {
  if (!activeFlow) return;
  const newIndex = activeFlow.steps.length;
  const newStep = {
    id: generateStepId(newIndex),
    title: `Step ${newIndex + 1}`,
    instruction: newIndex === 0 ? 'Process user input:\n{{input}}' : 'Refine previous output:\n{{prev}}',
    provider: 'inherit',
    model: 'inherit',
    contextProfileId: 'inherit',
    temperature: 0.3,
    maxTokens: 4096
  };

  const updated = [...activeFlow.steps, newStep];
  handleStepsChanged(updated);
  showToast(`Added Step ${newIndex + 1}`);
}

/**
 * Deletes a step from the active workflow.
 * @param {number} index
 */
export function deleteFlowStep(index) {
  if (!activeFlow || activeFlow.steps.length <= 1) {
    showToast('A workflow must have at least one step.', 'error');
    return;
  }

  const updated = activeFlow.steps.filter((_, i) => i !== index);
  openAdvancedStepIndices.delete(index);
  handleStepsChanged(updated);
  showToast(`Removed Step ${index + 1}`);
}

/**
 * Moves a step up (-1) or down (+1).
 * @param {number} index
 * @param {number} direction
 */
export function moveFlowStep(index, direction) {
  if (!activeFlow) return;
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= activeFlow.steps.length) return;

  const steps = [...activeFlow.steps];
  const temp = steps[index];
  steps[index] = steps[targetIndex];
  steps[targetIndex] = temp;

  openAdvancedStepIndices.clear();
  handleStepsChanged(steps);
}

/**
 * Duplicates a specific step.
 * @param {number} index
 */
export function duplicateFlowStep(index) {
  if (!activeFlow || !activeFlow.steps[index]) return;
  const source = activeFlow.steps[index];
  const newStep = {
    ...source,
    id: generateStepId(activeFlow.steps.length),
    title: `${source.title} (Copy)`
  };

  const steps = [...activeFlow.steps];
  steps.splice(index + 1, 0, newStep);
  handleStepsChanged(steps);
  showToast(`Duplicated Step ${index + 1}`);
}

/**
 * Updates step title in activeFlow.
 * @param {number} index
 * @param {string} title
 */
export function updateStepTitle(index, title) {
  if (!activeFlow || !activeFlow.steps[index]) return;
  activeFlow.steps[index].title = title;
}

/**
 * Updates step instruction in activeFlow and triggers invalidation check.
 * @param {number} index
 * @param {string} instruction
 */
export function updateStepInstruction(index, instruction) {
  if (!activeFlow || !activeFlow.steps[index]) return;
  activeFlow.steps[index].instruction = instruction;

  if (lastRunStepsSnapshot && flowResults.length > 0) {
    const inv = computeInvalidatedSteps({
      oldSteps: lastRunStepsSnapshot,
      newSteps: activeFlow.steps,
      currentResults: flowResults
    });
    if (inv.hasInvalidations) {
      inv.invalidatedStepIds.forEach(id => invalidatedStepIds.add(id));
      const staleNotice = document.getElementById('flowInvalidationNotice');
      if (staleNotice) staleNotice.style.display = 'flex';
    }
  }

  const validationAlert = document.getElementById('flowValidationAlert');
  const validationList = document.getElementById('flowValidationErrorsList');
  const validation = validateStepReferences(activeFlow.steps);
  if (validationAlert && validationList) {
    if (!validation.isValid) {
      validationAlert.style.display = 'block';
      validationList.innerHTML = validation.errors.map(err => `
        <div class="flow-validation-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>${escapeHtml(err.message)}</span>
        </div>
      `).join('');
    } else {
      validationAlert.style.display = 'none';
    }
  }
}

/**
 * Inserts a variable chip tag into the step instruction textarea at cursor position.
 * @param {number} index
 * @param {string} tag
 */
export function insertFlowVariable(index, tag) {
  const textarea = document.getElementById(`step-instruction-${index}`);
  if (!textarea) return;

  const insertText = `{{${tag}}}`;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const text = textarea.value;

  const updatedText = text.substring(0, start) + insertText + text.substring(end);
  textarea.value = updatedText;
  textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
  textarea.focus();

  updateStepInstruction(index, updatedText);
}

/**
 * Creates a new custom workflow and enters Builder mode.
 */
export function createCustomFlow() {
  const newFlow = createFlow({
    title: 'New Workflow Pipeline',
    category: 'General',
    description: 'Custom multi-step sequential workflow.',
    defaultContextProfileId: '',
    steps: [
      { id: generateStepId(0), title: 'Step 1', instruction: 'Process initial input:\n{{input}}', provider: 'inherit', model: 'inherit', contextProfileId: 'inherit', temperature: 0.3, maxTokens: 4096 },
      { id: generateStepId(1), title: 'Step 2', instruction: 'Analyze previous results:\n{{prev}}', provider: 'inherit', model: 'inherit', contextProfileId: 'inherit', temperature: 0.3, maxTokens: 4096 }
    ]
  });

  refreshFlowData();
  selectFlow(newFlow.id);
  setFlowMode('edit');
  showToast('Created new workflow. Configure your steps below.');
}

/**
 * Duplicates the active workflow or workflow by ID.
 * @param {string} [flowId]
 */
export function duplicateActiveFlow(flowId) {
  const targetId = flowId || activeFlow?.id;
  if (!targetId) return;

  const duplicated = duplicateFlow(targetId);
  if (duplicated) {
    refreshFlowData();
    selectFlow(duplicated.id);
    showToast(`Duplicated "${duplicated.title}"`);
  }
}

/**
 * Deletes the active workflow or workflow by ID.
 * @param {string} [flowId]
 */
export function deleteActiveFlow(flowId) {
  const targetId = flowId || activeFlow?.id;
  if (!targetId) return;

  const target = getFlowById(targetId);
  if (target?.isBuiltIn) {
    showToast('Built-in workflows cannot be deleted.', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to delete workflow "${target?.title || 'this workflow'}"?`)) {
    return;
  }

  deleteFlow(targetId);
  refreshFlowData();
  activeFlow = allFlows[0] || null;
  selectFlow(activeFlow?.id);
  showToast('Workflow deleted.');
}

/**
 * Saves changes made in the Workflow Builder to localStorage.
 */
export function saveActiveFlow() {
  if (!activeFlow) return;

  const titleInput = document.getElementById('flowEditTitle');
  const catInput = document.getElementById('flowEditCategory');
  const descInput = document.getElementById('flowEditDesc');
  const defaultProfSelect = document.getElementById('flowEditDefaultProfile');

  const title = (titleInput?.value || '').trim() || 'Untitled Workflow';
  const category = catInput?.value || 'General';
  const description = (descInput?.value || '').trim();
  const defaultContextProfileId = defaultProfSelect?.value || '';

  const refValidation = validateStepReferences(activeFlow.steps);
  if (!refValidation.isValid) {
    showToast('Cannot save: workflow contains invalid variable references.', 'error');
    return;
  }

  const paramValidation = validateStepParameters(activeFlow.steps);
  if (!paramValidation.isValid) {
    showToast('Cannot save: step parameters are invalid.', 'error');
    return;
  }

  const updated = saveFlow({
    ...activeFlow,
    title,
    category,
    description,
    defaultContextProfileId
  });

  if (updated) {
    activeFlow = updated;
    refreshFlowData();
    renderFlowList();

    const titleEl = document.getElementById('flowActiveTitle');
    const descEl = document.getElementById('flowActiveDesc');
    const catEl = document.getElementById('flowActiveCategory');
    if (titleEl) titleEl.textContent = updated.title;
    if (descEl) descEl.textContent = updated.description;
    if (catEl) catEl.textContent = updated.category;

    showToast('Workflow changes saved successfully!');
  }
}

/**
 * Exports all workflows as a sanitized JSON file (credentials strictly stripped).
 */
export function exportCurrentFlows() {
  const json = exportFlowsJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pecut-flows-${new Date().toISOString().slice(0, 10)}.pecut-flow.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Workflows exported successfully!');
}

/**
 * Imports workflows from a chosen JSON file.
 * @param {File} file
 */
export function importFlowsFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const result = importFlowsJSON(content);
    if (result.success) {
      refreshFlowData();
      renderFlowList();
      if (allFlows.length > 0) {
        selectFlow(allFlows[0].id);
      }
      showToast(`Successfully imported ${result.count} workflow(s)!`);
    } else {
      showToast(`Import failed: ${result.error}`, 'error');
    }
  };
  reader.readAsText(file);
}

/**
 * Cancels active execution immediately via AbortController.
 */
export function cancelActiveExecution() {
  if (executionState !== 'running') return;
  setExecutionState('cancelling', { label: 'Cancelling pipeline execution...' });
  if (currentAbortController) {
    currentAbortController.abort();
  }
}

/**
 * Resets run state back to idle.
 */
export function resetFlowRun() {
  stopTelemetryTimer();
  currentAbortController = null;
  setExecutionState('idle');
  renderActiveFlowView();
}

/**
 * Internal orchestrator for running or resuming a pipeline flow.
 * @param {Object} opts
 * @param {number} [opts.startIndex=0]
 * @param {Array<Object>} [opts.initialOutputs=[]]
 * @param {boolean} [opts.singleStepOnly=false]
 * @param {Function} [opts.transportFn]
 */
export async function executeFlowPipelineInternal(opts = {}) {
  const {
    startIndex = 0,
    initialOutputs = [],
    singleStepOnly = false,
    transportFn
  } = opts;

  // Prevent double execution
  if (executionState === 'running' || executionState === 'cancelling' || executionState === 'validating') {
    return;
  }

  const inputEl = document.getElementById('flowRootInput');
  const rootInput = (inputEl?.value || '').trim() || (currentRunRecord?.input || '');

  if (!rootInput) {
    showToast('Please enter an initial topic or requirement to run this flow.', 'error');
    return;
  }

  // 1. Validation Phase
  setExecutionState('validating', { label: 'Validating workflow references & provider credentials...' });

  const refValidation = validateStepReferences(activeFlow.steps);
  if (!refValidation.isValid) {
    setExecutionState('failed', { error: refValidation.errors[0].message, failedIndex: refValidation.errors[0].stepIndex });
    showToast('Cannot run: workflow contains invalid variable references.', 'error');
    setFlowMode('edit');
    return;
  }

  const paramValidation = validateStepParameters(activeFlow.steps);
  if (!paramValidation.isValid) {
    setExecutionState('failed', { error: paramValidation.errors[0].message, failedIndex: paramValidation.errors[0].stepIndex });
    showToast('Cannot run: step parameters are invalid.', 'error');
    setFlowMode('edit');
    return;
  }

  const activeConfig = loadBYOKConfig();
  const savedProfiles = loadProviderProfiles();
  const credValidation = validateProviderCredentials(activeFlow, activeConfig, savedProfiles);
  if (!credValidation.allReady) {
    setExecutionState('failed', { error: credValidation.missing[0].message, failedIndex: credValidation.missing[0].stepIndex });
    showToast(credValidation.missing[0].message, 'error');
    setFlowMode('edit');
    return;
  }

  // 2. Prepare Snapshot & State
  if (startIndex === 0) {
    flowResults = [];
    invalidatedStepIds.clear();
    lastRunStepsSnapshot = JSON.parse(JSON.stringify(activeFlow.steps));
    totalTokensAccumulated = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    currentRunRecord = {
      id: 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      flowId: activeFlow.id,
      flowTitle: activeFlow.title,
      status: 'running',
      input: rootInput,
      startedAt: new Date().toISOString(),
      flowSnapshot: createRunSnapshot(activeFlow),
      stepResults: []
    };
    saveFlowRun(currentRunRecord);

    // Reset visualizer nodes
    activeFlow.steps.forEach((_, idx) => updateStepNodeStatus(idx, 'ready'));
  } else {
    // Resume or Retry: keep existing results up to startIndex
    flowResults = [...initialOutputs];
  }

  const workflowToRun = currentRunRecord?.flowSnapshot || activeFlow;
  currentAbortController = new AbortController();

  startTelemetryTimer();
  setExecutionState('running', {
    label: singleStepOnly
      ? `Retrying Step ${startIndex + 1}: ${workflowToRun.steps[startIndex]?.title}...`
      : `Executing Step ${startIndex + 1} of ${workflowToRun.steps.length}...`
  });

  try {
    const runResult = await executeWorkflowPipeline({
      flow: workflowToRun,
      input: rootInput,
      startIndex,
      initialStepOutputs: flowResults,
      singleStepOnly,
      signal: currentAbortController.signal,
      activeConfig,
      savedProfiles,
      allProfiles: appState.profiles || [],
      transportFn: transportFn || undefined,
      callbacks: {
        onStepStart: (info) => {
          updateStepNodeStatus(info.stepIndex, 'running');
          const totalSteps = workflowToRun.steps.length;
          const progressPct = Math.round((info.stepIndex / totalSteps) * 100);
          const fill = document.getElementById('telemetryProgressFill');
          if (fill) fill.style.width = `${progressPct}%`;
          const label = document.getElementById('telemetryProgressLabel');
          if (label) {
            label.textContent = singleStepOnly
              ? `Retrying Step ${info.stepIndex + 1}: ${info.stepTitle}...`
              : `Step ${info.stepIndex + 1} of ${totalSteps}: ${info.stepTitle}`;
          }
        },
        onStepSuccess: (record) => {
          updateStepNodeStatus(record.stepIndex, 'completed', record);
          totalTokensAccumulated.promptTokens += (record.usage?.promptTokens || 0);
          totalTokensAccumulated.completionTokens += (record.usage?.completionTokens || 0);
          totalTokensAccumulated.totalTokens += (record.usage?.totalTokens || 0);

          const tokEl = document.getElementById('telemetryTokens');
          if (tokEl) {
            tokEl.style.display = 'inline-block';
            tokEl.textContent = `${totalTokensAccumulated.totalTokens.toLocaleString()} tokens`;
          }

          // Persist step output immediately
          if (currentRunRecord) {
            if (record.stepIndex < currentRunRecord.stepResults.length) {
              currentRunRecord.stepResults[record.stepIndex] = record;
            } else {
              currentRunRecord.stepResults.push(record);
            }
            saveFlowRun(currentRunRecord);
          }
        },
        onStepError: (errInfo) => {
          updateStepNodeStatus(errInfo.stepIndex, 'failed');
        }
      }
    });

    stopTelemetryTimer();
    flowResults = runResult.results;

    if (singleStepOnly) {
      // Step Retry Finished
      lastFailedStepIndex = startIndex;
      if (currentRunRecord) {
        currentRunRecord.stepResults = flowResults;
        currentRunRecord.status = 'failed';
        saveFlowRun(currentRunRecord);
      }
      setExecutionState('failed', {
        label: `Step ${startIndex + 1} retried successfully! Click Resume to continue pipeline.`,
        failedIndex: startIndex + 1 < workflowToRun.steps.length ? startIndex + 1 : startIndex
      });
      showToast(`Step ${startIndex + 1} retried successfully!`);
    } else {
      // Full Workflow Finished
      const fill = document.getElementById('telemetryProgressFill');
      if (fill) fill.style.width = '100%';

      if (currentRunRecord) {
        currentRunRecord.stepResults = flowResults;
        currentRunRecord.status = 'completed';
        currentRunRecord.completedAt = new Date().toISOString();
        saveFlowRun(currentRunRecord);
      }

      setExecutionState('completed', { label: 'Pipeline execution finished successfully!' });
      renderFlowResults();
      renderFlowRunHistory();
      logHistory('Pecut Flow Pipeline', `Flow: ${activeFlow.title} — Input: ${rootInput.slice(0, 80)}`, activeFlow.category);
      showToast('Pipeline execution finished successfully!');
    }
  } catch (err) {
    stopTelemetryTimer();

    const isAborted = err.name === 'AbortError' || currentAbortController?.signal?.aborted;

    if (isAborted) {
      // Cancelled by user
      const failedIdx = typeof err.failedStepIndex === 'number' ? err.failedStepIndex : startIndex;
      updateStepNodeStatus(failedIdx, 'cancelled');
      lastFailedStepIndex = failedIdx;

      if (currentRunRecord) {
        currentRunRecord.status = 'cancelled';
        if (Array.isArray(err.partialResults)) {
          currentRunRecord.stepResults = err.partialResults;
        }
        saveFlowRun(currentRunRecord);
      }

      setExecutionState('cancelled', {
        label: `Pipeline cancelled at Step ${failedIdx + 1}. You can Resume when ready.`
      });
      renderFlowRunHistory();
      showToast('Pipeline execution cancelled.', 'info');
    } else {
      // Failed with error
      const failedIdx = typeof err.failedStepIndex === 'number' ? err.failedStepIndex : startIndex;
      lastFailedStepIndex = failedIdx;
      updateStepNodeStatus(failedIdx, 'failed');

      if (currentRunRecord) {
        currentRunRecord.status = 'failed';
        currentRunRecord.error = { message: err.message, stepIndex: failedIdx };
        if (Array.isArray(err.partialResults)) {
          currentRunRecord.stepResults = err.partialResults;
        }
        saveFlowRun(currentRunRecord);
      }

      setExecutionState('failed', {
        error: `Step ${failedIdx + 1} failed: ${err.message}`,
        failedIndex: failedIdx
      });
      renderFlowRunHistory();
      showToast(`Step ${failedIdx + 1} failed: ${err.message}`, 'error');
    }
  } finally {
    currentAbortController = null;
  }
}

/**
 * Initiates execution of the active workflow pipeline from Step 1.
 */
export async function runActiveFlow() {
  await executeFlowPipelineInternal({ startIndex: 0, initialOutputs: [], singleStepOnly: false });
}

/**
 * Retries ONLY the single failed step without running downstream steps.
 */
export async function retryFailedStep() {
  const failedIdx = lastFailedStepIndex !== null
    ? lastFailedStepIndex
    : (currentRunRecord?.stepResults?.length || 0);

  // Retain outputs of prior successful steps before failedIdx
  const priorOutputs = Array.isArray(currentRunRecord?.stepResults)
    ? currentRunRecord.stepResults.slice(0, failedIdx)
    : [];

  await executeFlowPipelineInternal({
    startIndex: failedIdx,
    initialOutputs: priorOutputs,
    singleStepOnly: true
  });
}

/**
 * Resumes pipeline execution from the failed or cancelled step to completion.
 */
export async function resumePipeline() {
  // If cancelled in middle of step k, stepResults has k completed steps (0 to k-1)
  const resumeIdx = Array.isArray(currentRunRecord?.stepResults)
    ? currentRunRecord.stepResults.length
    : 0;

  const priorOutputs = Array.isArray(currentRunRecord?.stepResults)
    ? [...currentRunRecord.stepResults]
    : [];

  await executeFlowPipelineInternal({
    startIndex: resumeIdx,
    initialOutputs: priorOutputs,
    singleStepOnly: false
  });
}

/**
 * Formats full pipeline results into consolidated markdown.
 * @param {Array<Object>} results
 * @param {string} [title]
 * @returns {string}
 */
export function formatFlowOutput(results, title = 'Workflow') {
  if (!Array.isArray(results) || results.length === 0) return '';
  return results.map((r, i) => {
    const stepTitle = r.title || `Step ${i + 1}`;
    return `### Step ${i + 1}: ${stepTitle}\n\n${r.output || ''}`;
  }).join('\n\n---\n\n');
}

/**
 * Updates display visibility between rendered Markdown and raw text.
 */
function updateOutputViewModeVisibility() {
  const outputBox = document.getElementById('flowActiveResultOutput');
  const renderedBox = document.getElementById('flowActiveResultRendered');
  const btnMd = document.getElementById('btnModeMarkdown');
  const btnRaw = document.getElementById('btnModeRaw');

  if (btnMd && btnRaw) {
    if (outputViewMode === 'rendered') {
      btnMd.classList.add('active');
      btnRaw.classList.remove('active');
    } else {
      btnRaw.classList.add('active');
      btnMd.classList.remove('active');
    }
  }

  if (renderedBox && outputBox) {
    if (outputViewMode === 'rendered') {
      renderedBox.style.display = 'block';
      outputBox.style.display = 'none';
    } else {
      renderedBox.style.display = 'none';
      outputBox.style.display = 'block';
    }
  }
}

/**
 * Sets output view mode ('rendered' | 'raw').
 * @param {'rendered'|'raw'} mode
 */
export function setFlowOutputViewMode(mode) {
  outputViewMode = mode === 'raw' ? 'raw' : 'rendered';
  updateOutputViewModeVisibility();
}

/**
 * Returns current active output text.
 * @returns {string}
 */
export function getActiveFlowOutputText() {
  if (activeResultTabIndex === -1) {
    return formatFlowOutput(flowResults, activeFlow?.title);
  }
  return flowResults[activeResultTabIndex]?.output || '';
}

/**
 * Switches the active result tab.
 * @param {number} tabIndex - Step index or -1 for consolidated output
 */
export function switchFlowResultTab(tabIndex) {
  activeResultTabIndex = tabIndex;

  const tabs = document.querySelectorAll('#flowResultTabs .comp-tab');
  tabs.forEach((t, i) => {
    if (tabIndex === -1 && i === tabs.length - 1) {
      t.classList.add('active');
    } else if (i === tabIndex) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  const outputBox = document.getElementById('flowActiveResultOutput');
  const renderedBox = document.getElementById('flowActiveResultRendered');
  const thinkingContainer = document.getElementById('flowThinkingContainer');

  let activeText = '';
  let activeReasoning = '';

  if (tabIndex === -1) {
    activeText = formatFlowOutput(flowResults, activeFlow?.title);
  } else if (flowResults[tabIndex]) {
    activeText = flowResults[tabIndex].output || '';
    activeReasoning = flowResults[tabIndex].reasoning || '';
  }

  // Collapsible Reasoning / Thinking Process Box for reasoning models
  if (thinkingContainer) {
    if (activeReasoning && activeReasoning.trim()) {
      thinkingContainer.innerHTML = `
        <details class="flow-thinking-box" open>
          <summary>🧠 Thinking Process (${activeReasoning.trim().length.toLocaleString()} chars)</summary>
          <pre>${escapeHtml(activeReasoning.trim())}</pre>
        </details>
      `;
    } else {
      thinkingContainer.innerHTML = '';
    }
  }

  if (outputBox) {
    outputBox.textContent = activeText;
  }
  if (renderedBox) {
    renderedBox.innerHTML = formatRichMarkdown(activeText);
  }

  updateOutputViewModeVisibility();
}

/**
 * Renders tabbed pipeline results.
 */
export function renderFlowResults() {
  const container = document.getElementById('flowResultsContainer');
  const tabsHeader = document.getElementById('flowResultTabs');

  if (!container || !tabsHeader) return;

  container.style.display = 'block';

  tabsHeader.innerHTML = flowResults.map((r, idx) => `
    <button type="button" class="comp-tab ${idx === flowResults.length - 1 ? 'active' : ''}" onclick="window.switchFlowResultTab(${idx})">
      Step ${idx + 1}: ${escapeHtml(r.title)}
    </button>
  `).join('') + `
    <button type="button" class="comp-tab" onclick="window.switchFlowResultTab(-1)">
      Full Consolidated Output
    </button>
  `;

  switchFlowResultTab(flowResults.length - 1);
}

/**
 * Copies the currently viewed flow result to clipboard.
 */
export function copyActiveFlowResult() {
  const text = getActiveFlowOutputText();
  if (!text) {
    showToast('No flow output available to copy.', 'error');
    return;
  }
  navigator.clipboard.writeText(text);
  showToast('Flow output copied to clipboard!');
}

/**
 * Downloads active output as a formatted Markdown (.md) file.
 */
export function downloadFlowResultMarkdown() {
  const text = getActiveFlowOutputText();
  if (!text) {
    showToast('No output to download.', 'error');
    return;
  }
  const isConsolidated = activeResultTabIndex === -1;
  const stepTitle = (!isConsolidated && flowResults[activeResultTabIndex])
    ? flowResults[activeResultTabIndex].title
    : 'Consolidated Pipeline Output';

  const header = `# ${activeFlow?.title || 'Pecut Flow Pipeline'}\n` +
    `> **Step:** ${stepTitle}\n` +
    `> **Workflow ID:** ${activeFlow?.id || 'unknown'}\n` +
    `> **Exported At:** ${new Date().toLocaleString()}\n\n---\n\n`;

  const mdContent = header + text;
  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = (activeFlow?.title || 'flow').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `pecut-${slug}-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Flow output downloaded as Markdown (.md)!');
}

/**
 * Sends active flow result to Workspace Canvas document editor.
 */
export function sendFlowToCanvas() {
  const text = getActiveFlowOutputText();
  if (!text) {
    showToast('No flow output available to send to Canvas.', 'error');
    return;
  }
  applyContentToDocument(text);
  switchView('canvas');
  showToast('Flow output transferred to Workspace Canvas!');
}

/**
 * Sends active flow result to Prompt Builder objective input.
 */
export function sendFlowToBuilder() {
  const text = getActiveFlowOutputText();
  if (!text) {
    showToast('No flow output available to send to Builder.', 'error');
    return;
  }
  const builderObj = document.getElementById('builderObjective');
  if (builderObj) builderObj.value = text;
  switchView('builder');
  showToast('Flow output transferred to Prompt Builder!');
}

/**
 * Saves active flow result to prompt library.
 */
export function saveFlowToLibrary() {
  const text = getActiveFlowOutputText();
  if (!text || !text.trim()) {
    showToast('No flow output available to save.', 'error');
    return;
  }

  const isConsolidated = activeResultTabIndex === -1;
  const stepLabel = (!isConsolidated && flowResults[activeResultTabIndex])
    ? ` - Step ${activeResultTabIndex + 1}`
    : ' - Full Output';

  const newPrompt = {
    id: 'prompt-' + Date.now(),
    title: `${activeFlow?.title || 'Workflow'}${stepLabel}`,
    category: activeFlow?.category || 'Productivity',
    content: text,
    isFavorite: true,
    createdAt: new Date().toISOString()
  };

  appState.savedPrompts.unshift(newPrompt);
  saveState();
  showToast('Flow pipeline result saved to Library!');
}

/**
 * Renders the execution run history list.
 */
export function renderFlowRunHistory() {
  const listEl = document.getElementById('flowRunHistoryList');
  if (!listEl) return;

  const allRuns = loadFlowRuns();
  const currentFlowId = activeFlow?.id;
  const runs = currentFlowId ? allRuns.filter(r => r.flowId === currentFlowId) : allRuns;

  if (runs.length === 0) {
    listEl.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.82rem;">
        No past runs recorded for this workflow yet.
      </div>
    `;
    return;
  }

  listEl.innerHTML = runs.map(run => {
    const statusClass = run.status === 'completed' ? 'ready' : (run.status === 'failed' ? 'error' : 'warning');
    const timeFormatted = run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Unknown';
    const totalTokens = (run.stepResults || []).reduce((acc, s) => acc + (s.usage?.totalTokens || 0), 0);
    const stepsCount = run.stepResults?.length || 0;

    return `
      <div class="flow-history-item" data-run-id="${escapeHtml(run.id)}">
        <div class="history-item-meta">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="step-cred-pill ${statusClass}" style="font-size: 0.68rem; text-transform: uppercase;">${escapeHtml(run.status || 'unknown')}</span>
            <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${escapeHtml(timeFormatted)}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.2rem;">
            <span>${stepsCount} step(s) completed</span>
            ${totalTokens > 0 ? ` &bull; <span>${totalTokens.toLocaleString()} tokens</span>` : ''}
          </div>
        </div>
        <div class="history-item-actions">
          <button type="button" class="btn btn-secondary btn-xs" onclick="window.inspectFlowRun('${escapeHtml(run.id)}')">
            Inspect Output
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Inspects past run output by loading its step results into the viewer.
 * @param {string} runId
 */
export function inspectFlowRun(runId) {
  const run = getFlowRunById(runId);
  if (!run || !Array.isArray(run.stepResults) || run.stepResults.length === 0) {
    showToast('No output data found for this run.', 'error');
    return;
  }

  flowResults = run.stepResults;
  renderFlowResults();

  const resultsContainer = document.getElementById('flowResultsContainer');
  if (resultsContainer) {
    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  showToast(`Loaded results from run: ${run.id.slice(0, 12)}...`);
}

/**
 * Clears past execution runs.
 */
export function clearCurrentFlowRuns() {
  clearFlowRuns();
  renderFlowRunHistory();
  showToast('Flow run history cleared!');
}

// Global window attachments for DOM event handlers
if (typeof window !== 'undefined') {
  window.selectFlow = selectFlow;
  window.duplicateActiveFlow = duplicateActiveFlow;
  window.deleteActiveFlow = deleteActiveFlow;
  window.moveFlowStep = moveFlowStep;
  window.duplicateFlowStep = duplicateFlowStep;
  window.deleteFlowStep = deleteFlowStep;
  window.updateStepTitle = updateStepTitle;
  window.updateStepInstruction = updateStepInstruction;
  window.updateStepProvider = updateStepProvider;
  window.updateStepModel = updateStepModel;
  window.updateStepProfile = updateStepProfile;
  window.updateStepTemperature = updateStepTemperature;
  window.updateStepMaxTokens = updateStepMaxTokens;
  window.toggleStepAdvanced = toggleStepAdvanced;
  window.updateFlowDefaultProfile = updateFlowDefaultProfile;
  window.insertFlowVariable = insertFlowVariable;
  window.switchFlowResultTab = switchFlowResultTab;
  window.cancelActiveExecution = cancelActiveExecution;
  window.retryFailedStep = retryFailedStep;
  window.resumePipeline = resumePipeline;
  window.resetFlowRun = resetFlowRun;
  window.setFlowOutputViewMode = setFlowOutputViewMode;
  window.downloadFlowResultMarkdown = downloadFlowResultMarkdown;
  window.sendFlowToCanvas = sendFlowToCanvas;
  window.inspectFlowRun = inspectFlowRun;
  window.clearCurrentFlowRuns = clearCurrentFlowRuns;
}

/**
 * Initializes Pecut Flow module.
 */
export function initFlow() {
  refreshFlowData();

  // Mode Toggles
  const tabRun = document.getElementById('flowTabRun');
  if (tabRun) tabRun.addEventListener('click', () => setFlowMode('run'));

  const tabEdit = document.getElementById('flowTabEdit');
  if (tabEdit) tabEdit.addEventListener('click', () => setFlowMode('edit'));

  // Sidebar Actions
  const btnCreate = document.getElementById('btnCreateFlow');
  if (btnCreate) btnCreate.addEventListener('click', createCustomFlow);

  const btnExport = document.getElementById('btnExportFlows');
  if (btnExport) btnExport.addEventListener('click', exportCurrentFlows);

  const btnImportTrigger = document.getElementById('btnImportFlowTrigger');
  const fileInput = document.getElementById('flowFileInput');
  if (btnImportTrigger && fileInput) {
    btnImportTrigger.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        importFlowsFromFile(file);
        fileInput.value = '';
      }
    });
  }

  const searchInput = document.getElementById('flowSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderFlowList());
  }

  // Builder Header Actions
  const btnSave = document.getElementById('btnSaveFlow');
  if (btnSave) btnSave.addEventListener('click', saveActiveFlow);

  const btnDuplicateActive = document.getElementById('btnDuplicateActiveFlow');
  if (btnDuplicateActive) btnDuplicateActive.addEventListener('click', () => duplicateActiveFlow());

  const btnDeleteActive = document.getElementById('btnDeleteActiveFlow');
  if (btnDeleteActive) btnDeleteActive.addEventListener('click', () => deleteActiveFlow());

  const defaultProfSelect = document.getElementById('flowEditDefaultProfile');
  if (defaultProfSelect) {
    defaultProfSelect.addEventListener('change', (e) => updateFlowDefaultProfile(e.target.value));
  }

  // Add Step Button
  const btnAddStep = document.getElementById('btnAddStepBtn');
  if (btnAddStep) btnAddStep.addEventListener('click', addFlowStep);

  // Telemetry Controls
  const btnCancel = document.getElementById('btnCancelFlowExecution');
  if (btnCancel) btnCancel.addEventListener('click', cancelActiveExecution);

  const btnRetry = document.getElementById('btnRetryFailedStep');
  if (btnRetry) btnRetry.addEventListener('click', retryFailedStep);

  const btnResume = document.getElementById('btnResumePipeline');
  if (btnResume) btnResume.addEventListener('click', resumePipeline);

  const btnReset = document.getElementById('btnResetFlowRun');
  if (btnReset) btnReset.addEventListener('click', resetFlowRun);

  // Execution & Output Action Buttons
  const runBtn = document.getElementById('runFlowPipelineBtn');
  if (runBtn) runBtn.addEventListener('click', runActiveFlow);

  const copyBtn = document.getElementById('copyFlowResultBtn');
  if (copyBtn) copyBtn.addEventListener('click', copyActiveFlowResult);

  const downloadBtn = document.getElementById('downloadFlowResultBtn');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadFlowResultMarkdown);

  const canvasBtn = document.getElementById('sendFlowToCanvasBtn');
  if (canvasBtn) canvasBtn.addEventListener('click', sendFlowToCanvas);

  const sendBtn = document.getElementById('sendFlowToBuilderBtn');
  if (sendBtn) sendBtn.addEventListener('click', sendFlowToBuilder);

  const saveBtn = document.getElementById('saveFlowToLibBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveFlowToLibrary);

  // View Mode Toggles
  const btnMd = document.getElementById('btnModeMarkdown');
  if (btnMd) btnMd.addEventListener('click', () => setFlowOutputViewMode('rendered'));

  const btnRaw = document.getElementById('btnModeRaw');
  if (btnRaw) btnRaw.addEventListener('click', () => setFlowOutputViewMode('raw'));

  // Run History Clear Button
  const btnClearRuns = document.getElementById('btnClearFlowRuns');
  if (btnClearRuns) btnClearRuns.addEventListener('click', clearCurrentFlowRuns);

  // Register Navigation View Handler
  registerViewHandler('flow', () => {
    refreshFlowData();
    renderFlowList();
    if (currentMode === 'edit') {
      renderFlowBuilder();
    } else {
      renderActiveFlowView();
    }
  });

  renderFlowList();
  renderActiveFlowView();
}
