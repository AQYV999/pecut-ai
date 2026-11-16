/**
 * Pecut AI — Structured Prompt Builder
 * Apache-2.0 License
 */

import { appState, saveState } from './storage.js';
import { logHistory } from './history.js';
import { switchView } from './navigation.js';
import { showToast } from '../utils/helpers.js';

export function buildPromptString() {
  const role = (document.getElementById('builderRole')?.value || '').trim();
  const objective = (document.getElementById('builderObjective')?.value || '').trim();
  const context = (document.getElementById('builderContext')?.value || '').trim();
  const instructions = (document.getElementById('builderInstructions')?.value || '').trim();
  const inputData = (document.getElementById('builderInputData')?.value || '').trim();
  const outputFormat = document.getElementById('builderOutputFormat')?.value || 'Markdown Report';
  const tone = document.getElementById('builderTone')?.value || 'Professional & Authoritative';
  const language = document.getElementById('builderLanguage')?.value || 'id';
  const constraints = (document.getElementById('builderConstraints')?.value || '').trim();

  const parts = [];
  if (role) parts.push(`### ROLE / PERSONA\n${role}\n`);
  if (objective) parts.push(`### MAIN OBJECTIVE\n${objective}\n`);
  if (context) parts.push(`### CONTEXT & BACKGROUND\n${context}\n`);
  if (instructions) parts.push(`### INSTRUCTIONS\n${instructions}\n`);
  if (inputData) parts.push(`### INPUT DATA\n${inputData}\n`);
  parts.push(`### PARAMETERS\n- Tone & Style: ${tone}\n- Language: ${language}\n- Output Format: ${outputFormat}`);
  if (constraints) parts.push(`\n### CONSTRAINTS & RULES\n${constraints}`);

  return parts.join('\n');
}

export function updateBuilderPreview() {
  const previewBox = document.getElementById('builderPreviewText');
  if (!previewBox) return;

  const text = buildPromptString();
  previewBox.textContent = text;

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const tokens = Math.round(words * 1.3);

  const statsEl = document.getElementById('builderStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <span>Words: ${words}</span>
      <span>Chars: ${chars}</span>
      <span>Tokens (est): ~${tokens}</span>
    `;
  }
}

export function initPromptBuilder() {
  const fields = [
    'builderRole',
    'builderObjective',
    'builderContext',
    'builderInstructions',
    'builderInputData',
    'builderOutputFormat',
    'builderTone',
    'builderLanguage',
    'builderConstraints'
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateBuilderPreview);
      el.addEventListener('change', updateBuilderPreview);
    }
  });

  const generateBtn = document.getElementById('generatePromptBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      const promptText = buildPromptString();
      updateBuilderPreview();
      const cat = document.getElementById('builderCategory')?.value || 'General';
      logHistory('Prompt Builder Generation', promptText, cat);
      showToast('Prompt generated successfully!');
    });
  }

  const resetBtn = document.getElementById('resetBuilderBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      updateBuilderPreview();
      showToast('Builder form reset.', 'error');
    });
  }

  const saveBtn = document.getElementById('saveBuilderToLibBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const content = buildPromptString();
      if (!content.trim()) {
        showToast('Cannot save empty prompt.', 'error');
        return;
      }
      const title = (document.getElementById('builderObjective')?.value || '').trim() || 'Custom Prompt';
      const category = document.getElementById('builderCategory')?.value || 'Productivity';

      const newPrompt = {
        id: 'prompt-' + Date.now(),
        title,
        category,
        content,
        isFavorite: false,
        createdAt: new Date().toISOString()
      };

      appState.savedPrompts.unshift(newPrompt);
      saveState();
      showToast('Prompt saved to library!');
    });
  }

  const copyBtn = document.getElementById('copyBuilderPreviewBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const text = document.getElementById('builderPreviewText')?.textContent || '';
      navigator.clipboard.writeText(text);
      showToast('Prompt copied to clipboard!');
    });
  }

  const quickNewBtn = document.getElementById('quickNewPromptBtn');
  if (quickNewBtn) {
    quickNewBtn.addEventListener('click', () => {
      switchView('builder');
    });
  }

  updateBuilderPreview();
}
