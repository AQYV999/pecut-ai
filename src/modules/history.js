/**
 * Pecut AI — Execution History Management
 * Apache-2.0 License
 */

import { appState, saveState } from './storage.js';
import { switchView, registerViewHandler } from './navigation.js';
import { escapeHtml, showToast } from '../utils/helpers.js';

export function logHistory(actionType, promptText, category = 'General') {
  const item = {
    id: 'hist-' + Date.now(),
    timestamp: new Date().toISOString(),
    action: actionType,
    snippet: promptText,
    category: category
  };
  appState.history.unshift(item);
  if (appState.history.length > 50) appState.history.pop();
  saveState();
}

export function renderHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const searchInput = document.getElementById('historySearchInput');
  const query = searchInput ? searchInput.value.toLowerCase() : '';

  let filtered = appState.history.filter(h =>
    h.action.toLowerCase().includes(query) ||
    h.snippet.toLowerCase().includes(query) ||
    h.category.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No execution history recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(h => `
    <tr>
      <td>${new Date(h.timestamp).toLocaleString()}</td>
      <td><span class="badge-cat">${escapeHtml(h.action)}</span></td>
      <td><div class="snippet-text" title="${escapeHtml(h.snippet)}">${escapeHtml(h.snippet)}</div></td>
      <td>${escapeHtml(h.category)}</td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm" onclick="restoreHistoryItem('${h.id}')">Restore</button>
      </td>
    </tr>
  `).join('');
}

export function restoreHistoryItem(id) {
  const item = appState.history.find(h => h.id === id);
  if (item) {
    const builderObj = document.getElementById('builderObjective');
    if (builderObj) builderObj.value = item.snippet;
    switchView('builder');
    showToast('Restored prompt into Builder!');
  }
}

// Window global attachment for inline onclick compatibility
if (typeof window !== 'undefined') {
  window.restoreHistoryItem = restoreHistoryItem;
}

export function initHistory() {
  const searchInput = document.getElementById('historySearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', renderHistory);
  }

  const clearBtn = document.getElementById('clearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all execution history?')) {
        appState.history = [];
        saveState();
        renderHistory();
        showToast('History cleared.', 'error');
      }
    });
  }

  registerViewHandler('history', renderHistory);
  renderHistory();
}
