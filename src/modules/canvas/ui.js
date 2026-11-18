/**
 * Pecut AI — Workspace Canvas Sidebar, Toolbar & Initialization Controller
 * Apache-2.0 License
 */

import {
  loadWorkspaces,
  saveWorkspace,
  createWorkspace,
  deleteWorkspace,
  setActiveWorkspaceId,
  getActiveWorkspace,
  exportWorkspacesJSON,
  importWorkspacesJSON
} from '../workspaceStorage.js';
import { showToast, escapeHtml } from '../../utils/helpers.js';
import { switchView, registerViewHandler } from '../navigation.js';
import { appState } from '../storage.js';
import { updateSaveStatus } from './editor.js';
import { renderChatStream, sendChatMessage } from './chat.js';

let saveDebounceTimer = null;

/**
 * Renders the project workspace list in the sidebar.
 */
export function renderWorkspaceList() {
  const container = document.getElementById('canvasWsList');
  if (!container) return;

  const state = loadWorkspaces();
  container.innerHTML = state.workspaces.map(ws => {
    const isActive = ws.id === state.activeWorkspaceId;
    return `
      <div class="canvas-ws-item ${isActive ? 'active' : ''}" data-ws-id="${escapeHtml(ws.id)}" title="${escapeHtml(ws.title)}">
        <span class="canvas-ws-item-title">${escapeHtml(ws.title || 'Untitled Prompt')}</span>
        ${state.workspaces.length > 1 ? `
          <button type="button" class="canvas-ws-del-btn" data-del-id="${escapeHtml(ws.id)}" title="Delete Workspace">✕</button>
        ` : ''}
      </div>
    `;
  }).join('');

  // Attach selection listeners
  container.querySelectorAll('.canvas-ws-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.canvas-ws-del-btn')) return;
      const wsId = el.getAttribute('data-ws-id');
      if (wsId) {
        setActiveWorkspaceId(wsId);
        renderCurrentWorkspace();
      }
    });
  });

  // Attach delete listeners
  container.querySelectorAll('.canvas-ws-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wsId = btn.getAttribute('data-del-id');
      if (wsId && confirm('Are you sure you want to delete this workspace?')) {
        deleteWorkspace(wsId);
        renderWorkspaceList();
        renderCurrentWorkspace();
        showToast('Workspace deleted.');
      }
    });
  });
}

/**
 * Renders the Context Profile selector in the chat pane.
 */
export function renderProfileSelector() {
  const select = document.getElementById('canvasProfileSelect');
  if (!select) return;

  const currentWs = getActiveWorkspace();
  const profiles = appState.profiles || [];

  select.innerHTML = `
    <option value="">Default Assistant</option>
    ${profiles.map(p => `
      <option value="${escapeHtml(p.id)}" ${p.id === currentWs.contextProfileId ? 'selected' : ''}>
        ${escapeHtml(p.name)} (${escapeHtml(p.role || p.category)})
      </option>
    `).join('')}
  `;

  select.onchange = () => {
    saveWorkspace({
      id: currentWs.id,
      contextProfileId: select.value
    });
    showToast('Context profile updated for this workspace.');
  };
}

/**
 * Renders the active workspace document and title in the editor.
 */
export function renderCurrentWorkspace() {
  const ws = getActiveWorkspace();
  if (!ws) return;

  const titleInput = document.getElementById('canvasTitleInput');
  const editor = document.getElementById('canvasDocumentEditor');

  if (titleInput) titleInput.value = ws.title || 'Untitled Prompt';
  if (editor) editor.value = ws.documentContent || '';

  updateSaveStatus('Saved');
  renderProfileSelector();
  renderChatStream();
}

/**
 * Initializes the Workspace Canvas module and event listeners.
 */
export function initCanvas() {
  // Register view refresh callback
  registerViewHandler('canvas', () => {
    renderWorkspaceList();
    renderCurrentWorkspace();
  });

  // Initial render
  renderWorkspaceList();
  renderCurrentWorkspace();

  // Create workspace button
  const newWsBtn = document.getElementById('canvasNewWsBtn');
  if (newWsBtn) {
    newWsBtn.addEventListener('click', () => {
      const name = prompt('Masukkan nama proyek workspace baru:', 'New Prompt Project');
      if (name && name.trim()) {
        createWorkspace(name.trim(), '# ' + name.trim() + '\n\n');
        renderWorkspaceList();
        renderCurrentWorkspace();
        showToast('Workspace baru dibuat!');
      }
    });
  }

  // Toggle projects sidebar button
  const toggleSidebarBtn = document.getElementById('canvasToggleSidebarBtn');
  const sidebar = document.getElementById('canvasSidebar');
  if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // Title input auto-save
  const titleInput = document.getElementById('canvasTitleInput');
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      const ws = getActiveWorkspace();
      saveWorkspace({
        id: ws.id,
        title: titleInput.value.trim() || 'Untitled Prompt'
      });
      renderWorkspaceList();
    });
  }

  // Document editor auto-save with 400ms debounce
  const editor = document.getElementById('canvasDocumentEditor');
  if (editor) {
    editor.addEventListener('input', () => {
      updateSaveStatus('Saving...');
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = setTimeout(() => {
        const ws = getActiveWorkspace();
        saveWorkspace({
          id: ws.id,
          documentContent: editor.value
        });
        updateSaveStatus('Saved');
      }, 400);
    });
  }

  // Send message button & Enter key
  const sendBtn = document.getElementById('canvasSendBtn');
  const chatInput = document.getElementById('canvasChatInput');

  if (sendBtn) {
    sendBtn.addEventListener('click', sendChatMessage);
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  // Copy document button
  const copyDocBtn = document.getElementById('canvasCopyDocBtn');
  if (copyDocBtn && editor) {
    copyDocBtn.addEventListener('click', () => {
      if (!editor.value.trim()) {
        showToast('Lembar kerja masih kosong.');
        return;
      }
      navigator.clipboard.writeText(editor.value);
      showToast('Seluruh teks kanvas berhasil disalin!');
    });
  }

  // Download Markdown button
  const downloadMdBtn = document.getElementById('canvasDownloadMdBtn');
  if (downloadMdBtn && editor) {
    downloadMdBtn.addEventListener('click', () => {
      const ws = getActiveWorkspace();
      const content = editor.value;
      const filename = (ws.title || 'prompt').toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '.md';
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Dokumen diunduh sebagai ${filename}`);
    });
  }

  // Send to Optimizer button
  const sendToOptimizerBtn = document.getElementById('canvasSendToOptimizerBtn');
  if (sendToOptimizerBtn && editor) {
    sendToOptimizerBtn.addEventListener('click', () => {
      const content = editor.value.trim();
      if (!content) {
        showToast('Lembar kerja kosong. Tulis atau hasilkan draf terlebih dahulu.');
        return;
      }

      // Populate Optimizer textarea
      const optimizerInput = document.getElementById('optimizerInputText') || document.querySelector('#view-optimizer textarea');
      if (optimizerInput) {
        optimizerInput.value = content;
      }

      switchView('optimizer');
      showToast('Draf berhasil dikirim ke Prompt Optimizer!');
    });
  }

  // Export JSON button
  const exportBtn = document.getElementById('canvasExportAllBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const json = exportWorkspacesJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pecut_workspaces_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Semua workspace berhasil diekspor!');
    });
  }

  // Import JSON button
  const importBtn = document.getElementById('canvasImportAllBtn');
  const importFileInput = document.getElementById('canvasImportFileInput');
  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (text && importWorkspacesJSON(text)) {
          renderWorkspaceList();
          renderCurrentWorkspace();
          showToast('Workspaces berhasil diimpor!');
        } else {
          showToast('Gagal mengimpor file: Format JSON tidak valid.');
        }
      };
      reader.readAsText(file);
      importFileInput.value = '';
    });
  }

  // Mobile segmented toggle
  const mobileToggle = document.getElementById('canvasMobileToggle');
  const wrapper = document.querySelector('.canvas-workspace-wrapper');
  if (mobileToggle && wrapper) {
    wrapper.dataset.activePane = 'chat';
    mobileToggle.querySelectorAll('.canvas-toggle-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const pane = tab.getAttribute('data-pane');
        wrapper.dataset.activePane = pane;
        mobileToggle.querySelectorAll('.canvas-toggle-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });
  }
}
