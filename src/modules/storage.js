/**
 * Pecut AI — Local State & Storage Management
 * Apache-2.0 License
 */

// SECURITY: legacy `apiKey` and `provider` are stripped from persisted settings.
// Secrets must never live in the browser's localStorage.
export function loadSettings() {
  let parsed = {};
  try {
    parsed = JSON.parse(localStorage.getItem('pecut_settings') || '{}');
  } catch (_) {
    parsed = {};
  }
  if (parsed && ('apiKey' in parsed || 'provider' in parsed)) {
    delete parsed.apiKey;
    delete parsed.provider;
    localStorage.setItem('pecut_settings', JSON.stringify(parsed));
  }
  return {
    theme: parsed.theme || 'dark',
    language: parsed.language || 'id',
    tone: parsed.tone || 'Professional & Authoritative',
    format: parsed.format || 'Markdown Report'
  };
}

export function loadSavedPrompts() {
  try {
    return JSON.parse(localStorage.getItem('pecut_saved_prompts') || '[]');
  } catch (_) {
    return [];
  }
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('pecut_history') || '[]');
  } catch (_) {
    return [];
  }
}

export const appState = {
  savedPrompts: loadSavedPrompts(),
  history: loadHistory(),
  settings: loadSettings()
};

export function applyTheme(theme) {
  const resolvedTheme = theme || appState.settings.theme || 'dark';
  document.documentElement.setAttribute('data-theme', resolvedTheme);
}

export function saveState() {
  localStorage.setItem('pecut_saved_prompts', JSON.stringify(appState.savedPrompts));
  localStorage.setItem('pecut_history', JSON.stringify(appState.history));
  localStorage.setItem('pecut_settings', JSON.stringify(appState.settings));
  updateGlobalCounters();
}

export function updateGlobalCounters() {
  const savedCount = appState.savedPrompts.length;
  const histCount = appState.history.length;
  const favCount = appState.savedPrompts.filter(p => p.isFavorite).length;

  const libBadge = document.getElementById('libCountBadge');
  if (libBadge) libBadge.textContent = savedCount;
  const statSaved = document.getElementById('statSavedCount');
  if (statSaved) statSaved.textContent = savedCount;
  const statHist = document.getElementById('statHistoryCount');
  if (statHist) statHist.textContent = histCount;
  const metricSaved = document.getElementById('metricSaved');
  if (metricSaved) metricSaved.textContent = savedCount;
  const metricExec = document.getElementById('metricExecutions');
  if (metricExec) metricExec.textContent = histCount;
  const metricFav = document.getElementById('metricFavorites');
  if (metricFav) metricFav.textContent = favCount;
}
