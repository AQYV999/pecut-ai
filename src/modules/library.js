/**
 * Pecut AI — Prompt Library Management & CRUD
 * Apache-2.0 License
 */

import { appState, saveState } from './storage.js';
import { registerViewHandler } from './navigation.js';
import { escapeHtml, showToast } from '../utils/helpers.js';

export function renderLibrary() {
  const grid = document.getElementById('promptLibraryGrid');
  if (!grid) return;

  const searchInput = document.getElementById('libSearchInput');
  const catFilter = document.getElementById('libCategoryFilter');
  const sortSelect = document.getElementById('libSortSelect');

  const query = searchInput ? searchInput.value.toLowerCase() : '';
  const category = catFilter ? catFilter.value : 'all';
  const sort = sortSelect ? sortSelect.value : 'newest';

  let filtered = appState.savedPrompts.filter(item => {
    const matchesQuery = item.title.toLowerCase().includes(query) || item.content.toLowerCase().includes(query);
    const matchesCat = category === 'all' || item.category === category;
    return matchesQuery && matchesCat;
  });

  if (sort === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'oldest') {
    filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sort === 'title') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No saved prompts found. Create one in Prompt Builder or import from JSON.</div>';
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="prompt-card">
      <div class="card-top-row">
        <span class="badge-cat">${escapeHtml(item.category)}</span>
        <div class="card-actions-top">
          <button type="button" class="btn-icon" onclick="toggleFavorite('${item.id}')" title="Favorite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${item.isFavorite ? 'var(--accent)' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button type="button" class="btn-icon" onclick="duplicatePrompt('${item.id}')" title="Duplicate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="btn-icon" onclick="openEditModal('${item.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="btn-icon" onclick="deletePrompt('${item.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.content)}</p>
      <div class="prompt-card-footer">
        <span>${new Date(item.createdAt).toLocaleDateString()}</span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="copyPromptText('${item.id}')">Copy Prompt</button>
      </div>
    </div>
  `).join('');
}

export function toggleFavorite(id) {
  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    prompt.isFavorite = !prompt.isFavorite;
    saveState();
    renderLibrary();
    showToast(prompt.isFavorite ? 'Added to favorites' : 'Removed from favorites');
  }
}

export function duplicatePrompt(id) {
  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    const dup = {
      ...prompt,
      id: 'prompt-' + Date.now(),
      title: prompt.title + ' (Copy)',
      createdAt: new Date().toISOString()
    };
    appState.savedPrompts.unshift(dup);
    saveState();
    renderLibrary();
    showToast('Prompt duplicated successfully!');
  }
}

export function deletePrompt(id) {
  if (confirm('Are you sure you want to delete this prompt?')) {
    appState.savedPrompts = appState.savedPrompts.filter(p => p.id !== id);
    saveState();
    renderLibrary();
    showToast('Prompt deleted.', 'error');
  }
}

export function copyPromptText(id) {
  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    navigator.clipboard.writeText(prompt.content);
    showToast('Prompt copied to clipboard!');
  }
}

export function openEditModal(id) {
  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    document.getElementById('editPromptId').value = prompt.id;
    document.getElementById('editPromptTitle').value = prompt.title;
    document.getElementById('editPromptCategory').value = prompt.category;
    document.getElementById('editPromptBody').value = prompt.content;
    document.getElementById('editPromptModal').classList.add('active');
  }
}

export function closeEditModal() {
  const modal = document.getElementById('editPromptModal');
  if (modal) modal.classList.remove('active');
}

export function saveEditedPrompt() {
  const id = document.getElementById('editPromptId').value;
  const title = (document.getElementById('editPromptTitle')?.value || '').trim();
  const category = document.getElementById('editPromptCategory')?.value || 'Productivity';
  const content = (document.getElementById('editPromptBody')?.value || '').trim();

  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    prompt.title = title;
    prompt.category = category;
    prompt.content = content;
    saveState();
    renderLibrary();
    closeEditModal();
    showToast('Prompt updated successfully!');
  }
}

export function exportLibraryJSON() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState.savedPrompts, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `pecut_ai_library_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Library exported to JSON!');
}

export function importLibraryJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        appState.savedPrompts = [...imported, ...appState.savedPrompts];
        saveState();
        renderLibrary();
        showToast(`Successfully imported ${imported.length} prompts!`);
      } else {
        throw new Error('Invalid format');
      }
    } catch (_) {
      showToast('Error parsing JSON file.', 'error');
    }
  };
  reader.readAsText(file);
}

// Global window attachments for inline event handlers
if (typeof window !== 'undefined') {
  window.toggleFavorite = toggleFavorite;
  window.duplicatePrompt = duplicatePrompt;
  window.deletePrompt = deletePrompt;
  window.copyPromptText = copyPromptText;
  window.openEditModal = openEditModal;
}

export function initEditModal() {
  const closeBtn1 = document.getElementById('closeEditModal');
  if (closeBtn1) closeBtn1.addEventListener('click', closeEditModal);

  const closeBtn2 = document.getElementById('closeEditModalBtn');
  if (closeBtn2) closeBtn2.addEventListener('click', closeEditModal);

  const saveBtn = document.getElementById('saveEditModalBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveEditedPrompt);
}

export function initLibrary() {
  const searchInput = document.getElementById('libSearchInput');
  if (searchInput) searchInput.addEventListener('input', renderLibrary);

  const catFilter = document.getElementById('libCategoryFilter');
  if (catFilter) catFilter.addEventListener('change', renderLibrary);

  const sortSelect = document.getElementById('libSortSelect');
  if (sortSelect) sortSelect.addEventListener('change', renderLibrary);

  const exportBtn = document.getElementById('exportJsonBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportLibraryJSON);

  const importInput = document.getElementById('importJsonInput');
  if (importInput) importInput.addEventListener('change', importLibraryJSON);

  initEditModal();
  registerViewHandler('library', renderLibrary);
  renderLibrary();
}
