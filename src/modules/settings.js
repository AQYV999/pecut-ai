/**
 * Pecut AI — Settings & Data Management
 * Apache-2.0 License
 */

import { appState, saveState, applyTheme } from './storage.js';
import { showToast } from '../utils/helpers.js';

export function initSettings() {
  const s = appState.settings;

  const themeEl = document.getElementById('settingTheme');
  const langEl = document.getElementById('settingLanguage');
  const toneEl = document.getElementById('settingTone');
  const formatEl = document.getElementById('settingFormat');
  const apiStatusEl = document.getElementById('apiStatusText');

  if (themeEl) themeEl.value = s.theme || 'dark';
  if (langEl) langEl.value = s.language || 'id';
  if (toneEl) toneEl.value = s.tone || 'Professional & Authoritative';
  if (formatEl) formatEl.value = s.format || 'Markdown Report';

  // Apply active theme to document
  applyTheme(s.theme);

  // Provider status is server-controlled. No browser-side secret storage.
  if (apiStatusEl) apiStatusEl.textContent = 'Demo Engine Active';

  ['settingTheme', 'settingLanguage', 'settingTone', 'settingFormat'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        if (themeEl) appState.settings.theme = themeEl.value;
        if (langEl) appState.settings.language = langEl.value;
        if (toneEl) appState.settings.tone = toneEl.value;
        if (formatEl) appState.settings.format = formatEl.value;

        applyTheme(appState.settings.theme);
        saveState();
        showToast('Settings saved successfully!');
      });
    }
  });

  const exportAllBtn = document.getElementById('exportAllDataBtn');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
      const dl = document.createElement('a');
      dl.setAttribute('href', dataStr);
      dl.setAttribute('download', `pecut_ai_complete_backup_${Date.now()}.json`);
      document.body.appendChild(dl);
      dl.click();
      dl.remove();
      showToast('Complete workspace backup exported!');
    });
  }

  const clearAllBtn = document.getElementById('clearAllDataBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('WARNING: This will clear all saved prompts, history and settings. Continue?')) {
        localStorage.clear();
        location.reload();
      }
    });
  }
}
