/**
 * Pecut AI — Workspace Canvas & Interactive Chat Controller
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
} from './workspaceStorage.js';

import { completeChat, getActiveProviderInfo } from '../services/ai/client.js';
import { openAIModal } from './aiModal.js';
import { showToast, escapeHtml } from '../utils/helpers.js';
import { switchView, registerViewHandler } from './navigation.js';
import { appState } from './storage.js';

let saveDebounceTimer = null;
let isAiGenerating = false;

/**
 * Basic markdown-to-HTML parser for chat bubbles.
 * Safely renders code blocks, bold, lists, and inline code.
 * @param {string} text
 * @returns {string}
 */
export function formatChatMessage(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);

  // Fenced code blocks ```...```
  const withCodeBlocks = escaped.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code `...`
  const withInlineCode = withCodeBlocks.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold **...**
  const withBold = withInlineCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Paragraphs / line breaks
  return withBold.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
}

/**
 * Extracts prompt/content text from an AI response for Canvas application.
 * If code blocks exist, extracts the largest code block. Otherwise returns full text.
 * @param {string} rawText
 * @returns {string}
 */
export function extractCanvasContent(rawText) {
  if (!rawText) return '';
  const codeBlockRegex = /```(?:markdown|prompt|text)?\n([\s\S]*?)```/gi;
  const matches = [...rawText.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    // Find the longest code block
    matches.sort((a, b) => b[1].length - a[1].length);
    return matches[0][1].trim();
  }
  return rawText.trim();
}

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
 * Renders the chat message stream for the active workspace.
 */
export function renderChatStream() {
  const container = document.getElementById('canvasChatStream');
  if (!container) return;

  const ws = getActiveWorkspace();
  const messages = ws.messages || [];

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state-sm" style="margin: auto; text-align: center; color: var(--text-tertiary); padding: 2rem 1rem;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.5rem; opacity: 0.5;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <p style="margin: 0; font-size: 0.9rem;">Belum ada percakapan di proyek ini.</p>
        <small style="color: var(--text-secondary);">Ketik ide prompt Anda di bawah untuk mulai berdiskusi dengan AI.</small>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => {
    const isUser = msg.role === 'user';
    const isAssistant = msg.role === 'assistant';

    return `
      <div class="canvas-chat-msg ${escapeHtml(msg.role)}" data-msg-id="${escapeHtml(msg.id || '')}">
        <div class="canvas-msg-body">${formatChatMessage(msg.content)}</div>
        ${isAssistant ? `
          <div class="canvas-msg-actions">
            <button type="button" class="btn btn-secondary btn-xs apply-to-canvas-btn" title="Terapkan teks/prompt ini ke lembar kerja kanan">
              <span>📥 Terapkan ke Kanvas</span>
            </button>
            <button type="button" class="btn btn-ghost btn-xs copy-msg-btn" title="Salin pesan">
              <span>📋 Salin</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Wire action buttons
  container.querySelectorAll('.apply-to-canvas-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgEl = btn.closest('.canvas-chat-msg');
      const msgId = msgEl.getAttribute('data-msg-id');
      const targetMsg = messages.find(m => m.id === msgId);
      if (targetMsg) {
        applyContentToDocument(targetMsg.content);
      }
    });
  });

  container.querySelectorAll('.copy-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgEl = btn.closest('.canvas-chat-msg');
      const msgId = msgEl.getAttribute('data-msg-id');
      const targetMsg = messages.find(m => m.id === msgId);
      if (targetMsg) {
        navigator.clipboard.writeText(targetMsg.content);
        showToast('Pesan disalin ke clipboard!');
      }
    });
  });

  // Auto scroll to bottom
  container.scrollTop = container.scrollHeight;
}

/**
 * Applies AI response content directly to the Canvas Document editor.
 * @param {string} rawContent
 */
export function applyContentToDocument(rawContent) {
  const contentToApply = extractCanvasContent(rawContent);
  const editor = document.getElementById('canvasDocumentEditor');
  if (!editor) return;

  const ws = getActiveWorkspace();
  const currentVal = editor.value.trim();

  if (currentVal && !confirm('Ganti seluruh isi Kanvas dengan draf ini? (Pilih Cancel jika ingin menambahkan ke bagian bawah)')) {
    editor.value = currentVal + '\n\n---\n\n' + contentToApply;
  } else {
    editor.value = contentToApply;
  }

  saveWorkspace({
    id: ws.id,
    documentContent: editor.value
  });

  updateSaveStatus('Saved');
  showToast('Teks berhasil diterapkan ke Lembar Kerja Kanvas!');
}

/**
 * Updates the document save status indicator.
 * @param {string} text
 */
function updateSaveStatus(text) {
  const statusEl = document.getElementById('canvasSaveStatus');
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.style.opacity = text === 'Saving...' ? '0.6' : '1';
  }
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
 * Sends a chat message to the active AI provider with bounded history.
 */
export async function sendChatMessage() {
  if (isAiGenerating) return;

  const input = document.getElementById('canvasChatInput');
  if (!input) return;
  const userText = input.value.trim();
  if (!userText) return;

  const ws = getActiveWorkspace();
  const providerInfo = getActiveProviderInfo();

  // Guard: Zero-key state
  if (!providerInfo.hasKey && providerInfo.provider !== 'custom') {
    const stream = document.getElementById('canvasChatStream');
    if (stream) {
      const banner = document.createElement('div');
      banner.className = 'canvas-chat-msg system';
      banner.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 0.85rem; text-align: center;">
          <p style="margin: 0 0 0.5rem; color: #f59e0b; font-weight: 600;">Kunci API Belum Dikonfigurasi (BYOK)</p>
          <p style="margin: 0 0 0.65rem; font-size: 0.82rem; color: var(--text-secondary);">Untuk mengobrol interaktif dengan AI secara gratis, silakan masukkan API Key Groq atau Gemini Anda.</p>
          <button type="button" class="btn btn-primary btn-xs" id="canvasOpenByokBtn">⚡ Hubungkan API Key Gratis</button>
        </div>
      `;
      stream.appendChild(banner);
      stream.scrollTop = stream.scrollHeight;

      document.getElementById('canvasOpenByokBtn')?.addEventListener('click', openAIModal);
    }
    return;
  }

  // Clear input
  input.value = '';

  // Append user message
  const now = new Date().toISOString();
  const userMsg = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: userText,
    timestamp: now
  };

  const updatedMessages = [...(ws.messages || []), userMsg];
  saveWorkspace({
    id: ws.id,
    messages: updatedMessages
  });
  renderChatStream();

  // Render typing indicator
  const stream = document.getElementById('canvasChatStream');
  const typingEl = document.createElement('div');
  typingEl.className = 'canvas-chat-msg assistant typing-indicator';
  typingEl.id = 'canvasTypingIndicator';
  typingEl.innerHTML = `<em>Pecut AI (${escapeHtml(providerInfo.name)}) sedang berpikir...</em>`;
  if (stream) {
    stream.appendChild(typingEl);
    stream.scrollTop = stream.scrollHeight;
  }

  isAiGenerating = true;
  const sendBtn = document.getElementById('canvasSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    // Construct persona-infused system prompt
    let systemPrompt = `You are Pecut AI, a versatile, intelligent AI assistant and expert coder (similar to Hermes, Claude, and OpenCoder).
Directly fulfill the user's request:
- If the user asks for code, web HTML/CSS/JS, Python scripts, or full pages: write the complete, functional code directly in appropriate markdown code fences. Do NOT write a prompt about it; build the actual code requested!
- If the user asks a question, requests an explanation, analysis, or creative writing: answer directly and thoroughly.
- If the user asks to design or optimize a prompt: craft the structured prompt.
- Always be helpful, precise, and output clean Markdown with language tags for all code blocks.`;

    if (ws.contextProfileId) {
      const profile = (appState.profiles || []).find(p => p.id === ws.contextProfileId);
      if (profile) {
        systemPrompt += `\n\n[Active Persona]\nRole: ${profile.role || profile.name}\nTone: ${profile.tone || 'Professional'}\nContext: ${profile.context || ''}\nConstraints: ${profile.constraints || ''}`;
      }
    }

    // Pass latest canvas document context if present
    const docContext = ws.documentContent?.trim();
    if (docContext) {
      systemPrompt += `\n\nCurrent Canvas Document Draft:\n"""\n${docContext.slice(0, 3000)}\n"""`;
    }

    // Bounded history (latest 10 messages)
    const historyPayload = updatedMessages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));

    const response = await completeChat({
      systemPrompt,
      messages: historyPayload,
      temperature: 0.3
    });

    // Remove typing indicator
    document.getElementById('canvasTypingIndicator')?.remove();

    const assistantMsg = {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content: response.text,
      timestamp: new Date().toISOString()
    };

    saveWorkspace({
      id: ws.id,
      messages: [...updatedMessages, assistantMsg]
    });

    renderChatStream();
  } catch (err) {
    document.getElementById('canvasTypingIndicator')?.remove();
    showToast(`AI Error: ${err.message}`, 4000);

    const errorMsg = {
      id: 'msg_err_' + Date.now(),
      role: 'assistant',
      content: `⚠️ **Gagal menghubungi AI:** ${err.message}\n\nSilakan periksa koneksi atau ganti model di AI Connection Settings.`,
      timestamp: new Date().toISOString()
    };

    saveWorkspace({
      id: ws.id,
      messages: [...updatedMessages, errorMsg]
    });
    renderChatStream();
  } finally {
    isAiGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
  }
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
