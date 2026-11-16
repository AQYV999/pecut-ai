/**
 * Pecut AI — Workflow Chaining Engine (Pecut Flow)
 * Apache-2.0 License
 */

import { DEFAULT_FLOWS } from '../data/flows.js';
import { executeFlowStep } from '../services/ai/index.js';
import { logHistory } from './history.js';
import { switchView, registerViewHandler } from './navigation.js';
import { escapeHtml, showToast } from '../utils/helpers.js';
import { appState, saveState } from './storage.js';

let activeFlow = DEFAULT_FLOWS[0];
let flowResults = [];

export function renderFlowList() {
  const container = document.getElementById('flowSelectorList');
  if (!container) return;

  container.innerHTML = DEFAULT_FLOWS.map(f => `
    <div class="flow-picker-card ${f.id === activeFlow.id ? 'active' : ''}" onclick="selectFlow('${f.id}')">
      <div class="flow-picker-header">
        <span class="badge-cat">${escapeHtml(f.category)}</span>
        <span class="step-count-badge">${f.steps.length} Steps</span>
      </div>
      <h4>${escapeHtml(f.title)}</h4>
      <p>${escapeHtml(f.description)}</p>
    </div>
  `).join('');
}

export function selectFlow(flowId) {
  const flow = DEFAULT_FLOWS.find(f => f.id === flowId);
  if (!flow) return;

  activeFlow = flow;
  flowResults = [];
  renderFlowList();
  renderActiveFlowView();
}

export function renderActiveFlowView() {
  const titleEl = document.getElementById('flowActiveTitle');
  const descEl = document.getElementById('flowActiveDesc');
  const stepsContainer = document.getElementById('flowStepsVisualizer');
  const resultsContainer = document.getElementById('flowResultsContainer');

  if (titleEl) titleEl.textContent = activeFlow.title;
  if (descEl) descEl.textContent = activeFlow.description;

  if (stepsContainer) {
    stepsContainer.innerHTML = activeFlow.steps.map((step, idx) => `
      <div class="flow-step-node" id="step-node-${idx}">
        <div class="step-badge">${idx + 1}</div>
        <div class="step-content">
          <h5>${escapeHtml(step.title)}</h5>
          <p>${escapeHtml(step.instruction)}</p>
        </div>
        <div class="step-status" id="step-status-${idx}">
          <span class="status-indicator">Ready</span>
        </div>
      </div>
    `).join('');
  }

  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
}

export async function runActiveFlow() {
  const inputEl = document.getElementById('flowRootInput');
  const rootInput = (inputEl?.value || '').trim();

  if (!rootInput) {
    showToast('Please enter an initial topic or requirement to run this flow.', 'error');
    return;
  }

  const runBtn = document.getElementById('runFlowPipelineBtn');
  const originalHtml = runBtn ? runBtn.innerHTML : '';
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML = `
      <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Running Pipeline...
    `;
  }

  flowResults = [];
  let previousOutput = '';

  try {
    for (let i = 0; i < activeFlow.steps.length; i++) {
      const step = activeFlow.steps[i];
      const statusEl = document.getElementById(`step-status-${i}`);
      const nodeEl = document.getElementById(`step-node-${i}`);

      if (nodeEl) nodeEl.classList.add('running');
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="status-indicator running">
            <svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Processing...
          </span>
        `;
      }

      const stepResponse = await executeFlowStep({
        flowId: activeFlow.id,
        stepIndex: i,
        stepTitle: step.title,
        stepInstruction: step.instruction,
        inputData: rootInput,
        previousOutput: previousOutput
      });

      previousOutput = stepResponse.output || '';
      flowResults.push({
        stepIndex: i,
        title: step.title,
        output: previousOutput,
        mode: stepResponse.mode
      });

      if (nodeEl) {
        nodeEl.classList.remove('running');
        nodeEl.classList.add('completed');
      }
      if (statusEl) {
        statusEl.innerHTML = '<span class="status-indicator done">✓ Completed</span>';
      }
    }

    renderFlowResults();
    logHistory('Pecut Flow Pipeline', `Flow: ${activeFlow.title} — Input: ${rootInput.slice(0, 80)}`, activeFlow.category);
    showToast('Pipeline execution finished successfully!');
  } catch (err) {
    showToast('Pipeline execution failed: ' + err.message, 'error');
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = originalHtml;
    }
  }
}

export function renderFlowResults() {
  const container = document.getElementById('flowResultsContainer');
  const tabsHeader = document.getElementById('flowResultTabs');
  const outputBox = document.getElementById('flowActiveResultOutput');

  if (!container || !tabsHeader || !outputBox) return;

  container.style.display = 'block';

  tabsHeader.innerHTML = flowResults.map((r, idx) => `
    <button type="button" class="comp-tab ${idx === flowResults.length - 1 ? 'active' : ''}" onclick="switchFlowResultTab(${idx})">
      Step ${idx + 1}: ${escapeHtml(r.title)}
    </button>
  `).join('') + `
    <button type="button" class="comp-tab" onclick="switchFlowResultTab(-1)">
      Full Consolidated Output
    </button>
  `;

  // Default display: last step
  switchFlowResultTab(flowResults.length - 1);
}

export function switchFlowResultTab(tabIndex) {
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
  if (!outputBox) return;

  if (tabIndex === -1) {
    // Consolidated all steps
    const consolidated = flowResults.map((r, i) =>
      `============================================================\n` +
      `STAGE ${i + 1}: ${r.title.toUpperCase()}\n` +
      `============================================================\n\n` +
      `${r.output}\n\n`
    ).join('\n');
    outputBox.textContent = consolidated;
  } else if (flowResults[tabIndex]) {
    outputBox.textContent = flowResults[tabIndex].output;
  }
}

export function copyActiveFlowResult() {
  const outputBox = document.getElementById('flowActiveResultOutput');
  if (outputBox) {
    navigator.clipboard.writeText(outputBox.textContent);
    showToast('Flow output copied to clipboard!');
  }
}

export function sendFlowToBuilder() {
  const outputBox = document.getElementById('flowActiveResultOutput');
  if (outputBox) {
    const builderObj = document.getElementById('builderObjective');
    if (builderObj) builderObj.value = outputBox.textContent;
    switchView('builder');
    showToast('Flow output transferred to Prompt Builder!');
  }
}

export function saveFlowToLibrary() {
  const outputBox = document.getElementById('flowActiveResultOutput');
  if (!outputBox || !outputBox.textContent.trim()) {
    showToast('No flow output available to save.', 'error');
    return;
  }

  const newPrompt = {
    id: 'prompt-' + Date.now(),
    title: `${activeFlow.title} Result`,
    category: activeFlow.category || 'Productivity',
    content: outputBox.textContent,
    isFavorite: true,
    createdAt: new Date().toISOString()
  };

  appState.savedPrompts.unshift(newPrompt);
  saveState();
  showToast('Flow pipeline result saved to Library!');
}

// Global window attachments
if (typeof window !== 'undefined') {
  window.selectFlow = selectFlow;
  window.switchFlowResultTab = switchFlowResultTab;
}

export function initFlow() {
  const runBtn = document.getElementById('runFlowPipelineBtn');
  if (runBtn) runBtn.addEventListener('click', runActiveFlow);

  const copyBtn = document.getElementById('copyFlowResultBtn');
  if (copyBtn) copyBtn.addEventListener('click', copyActiveFlowResult);

  const sendBtn = document.getElementById('sendFlowToBuilderBtn');
  if (sendBtn) sendBtn.addEventListener('click', sendFlowToBuilder);

  const saveBtn = document.getElementById('saveFlowToLibBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveFlowToLibrary);

  registerViewHandler('flow', () => {
    renderFlowList();
    renderActiveFlowView();
  });

  renderFlowList();
  renderActiveFlowView();
}
