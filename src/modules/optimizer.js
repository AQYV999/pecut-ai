/**
 * Pecut AI — Prompt Optimizer & Structural Analysis
 * Apache-2.0 License
 */

import { logHistory } from './history.js';
import { switchView } from './navigation.js';
import { showToast } from '../utils/helpers.js';

export function analyzePromptLocally(text) {
  const lower = text.toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const sectionDefs = [
    { label: 'Role/Persona', re: /(^|\n)\s*(#+\s*)?(role|persona|act as)\b/i },
    { label: 'Objective', re: /(^|\n)\s*(#+\s*)?(objective|goal|task)\b/i },
    { label: 'Context', re: /(^|\n)\s*(#+\s*)?(context|background)\b/i },
    { label: 'Instructions', re: /(^|\n)\s*(#+\s*)?(instructions|steps)\b/i },
    { label: 'Constraints', re: /(^|\n)\s*(#+\s*)?(constraints|rules|do not|avoid)\b/i },
    { label: 'Output Format', re: /(^|\n)\s*(#+\s*)?(output format|format|respond with)\b/i }
  ];

  const sections = sectionDefs.filter(s => s.re.test(text)).map(s => s.label);
  const vagueTerms = ['good', 'nice', 'better', 'stuff', 'things', 'etc', 'bagus', 'lengkap'];
  const vagueHits = vagueTerms.reduce((n, t) => n + (lower.split(t).length - 1), 0);

  return {
    words,
    sections,
    hasRole: sections.includes('Role/Persona'),
    hasOutput: sections.includes('Output Format'),
    hasConstraints: sections.includes('Constraints'),
    vagueHits
  };
}

export function initOptimizer() {
  const runBtn = document.getElementById('runOptimizerBtn');
  if (runBtn) {
    runBtn.addEventListener('click', () => {
      const rawInput = (document.getElementById('optimizerInputText')?.value || '').trim();
      if (!rawInput) {
        showToast('Please enter an original prompt to optimize.', 'error');
        return;
      }

      const goals = Array.from(document.querySelectorAll('input[name="optGoal"]:checked')).map(el => el.value);

      // Deterministic structured optimization (Phase 0 / Stage 1 local engine)
      const optimized = `### OPTIMIZED PROMPT (Pecut AI Local Engine)\n\nRole: Expert Domain Specialist & Senior Prompt Engineer\nObjective: ${rawInput}\n\nContext:\n- High-performance execution environment.\n- Maintain rigorous adherence to user directives without unnecessary verbosity.\n\nStep-by-Step Instructions:\n1. Conduct comprehensive analysis of the core objective.\n2. Execute structured transformation ensuring zero ambiguity.\n3. Format output cleanly according to professional standards.\n\nConstraints:\n- Avoid introductory fluff or conversational filler.\n- Ensure deterministic, reproducible outputs.\n\nOutput Format: Structured Markdown Report.`;

      const outputEl = document.getElementById('optimizedOutputText');
      if (outputEl) outputEl.textContent = optimized;

      const metrics = analyzePromptLocally(rawInput);
      const report =
        `LOCAL STRUCTURAL ANALYSIS (no AI model used)\n` +
        `------------------------------------------------\n` +
        `This report is produced by a rule-based local analyzer. It does NOT\n` +
        `call an AI model and does NOT measure true output quality.\n\n` +
        `- Original length: ${rawInput.length} characters / ${metrics.words} words\n` +
        `- Active focus goals: ${goals.length ? goals.join(', ') : '(none selected)'}\n` +
        `- Detected sections: ${metrics.sections.length ? metrics.sections.join(', ') : 'none'}\n` +
        `- Has explicit output format: ${metrics.hasOutput ? 'yes' : 'no'}\n` +
        `- Has constraints/rules: ${metrics.hasConstraints ? 'yes' : 'no'}\n` +
        `- Has role/persona: ${metrics.hasRole ? 'yes' : 'no'}\n` +
        `- Vague-phrase count: ${metrics.vagueHits}\n\n` +
        `The structured version above adds standard sections (Role, Objective,\n` +
        `Context, Instructions, Constraints, Output Format). Whether it is\n` +
        `better depends on your task. For genuine AI optimization, configure\n` +
        `a provider on the server (see README / .env.example).`;

      const reportEl = document.getElementById('analysisReportContent');
      if (reportEl) {
        reportEl.innerHTML = `<pre style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-secondary); white-space:pre-wrap;">${report}</pre>`;
      }

      logHistory('Prompt Optimization', rawInput, 'Productivity');
      showToast('Prompt successfully optimized!');
    });
  }

  // Comparison Tabs
  document.querySelectorAll('.comp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.comp-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.comp-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPanel = document.getElementById(tab.getAttribute('data-target'));
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  const copyOptBtn = document.getElementById('copyOptimizedBtn');
  if (copyOptBtn) {
    copyOptBtn.addEventListener('click', () => {
      const text = document.getElementById('optimizedOutputText')?.textContent || '';
      navigator.clipboard.writeText(text);
      showToast('Optimized prompt copied!');
    });
  }

  const sendToBuilderBtn = document.getElementById('sendToBuilderBtn');
  if (sendToBuilderBtn) {
    sendToBuilderBtn.addEventListener('click', () => {
      const text = document.getElementById('optimizedOutputText')?.textContent || '';
      const objInput = document.getElementById('builderObjective');
      if (objInput) objInput.value = text;
      switchView('builder');
      showToast('Sent to Prompt Builder!');
    });
  }
}
