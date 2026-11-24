/**
 * Pecut AI — AI Chat UI Rendering & Event Controller
 * Apache-2.0 License
 */

import { completeChat, getActiveProviderInfo } from '../../services/ai/client.js';
import { openAIModal } from '../aiModal.js';
import { showToast, escapeHtml } from '../../utils/helpers.js';
import { formatRichMarkdown, renderThinkingBox } from '../../utils/markdown.js';
import { registerViewHandler } from '../navigation.js';
import { CHAT_MODES } from './modes.js';
import {
  loadChatSessions,
  getActiveChatSession,
  setActiveChatSessionId,
  createChatSession,
  saveChatSession,
  deleteChatSession,
  clearActiveChatSession,
  buildCleanHistoryPayload
} from './storage.js';
import { openHtmlPreviewModal } from './preview.js';

let isGenerating = false;

/**
 * Renders the session list in the chat sidebar.
 */
export function renderChatSidebar() {
  const container = document.getElementById('chatSessionList');
  if (!container) return;

  const state = loadChatSessions();
  container.innerHTML = state.sessions.map(s => {
    const isActive = s.id === state.activeSessionId;
    const modeObj = CHAT_MODES[s.mode] || CHAT_MODES.coder;
    return `
      <div class="chat-session-item ${isActive ? 'active' : ''}" data-session-id="${escapeHtml(s.id)}" title="${escapeHtml(s.title)}">
        <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden; flex: 1;">
          <span style="font-size: 0.9rem;">${modeObj.icon}</span>
          <span class="chat-session-title">${escapeHtml(s.title || 'Conversation')}</span>
        </div>
        ${state.sessions.length > 1 ? `
          <button type="button" class="chat-session-del-btn" data-del-id="${escapeHtml(s.id)}" title="Hapus Percakapan">✕</button>
        ` : ''}
      </div>
    `;
  }).join('');

  // Switch session
  container.querySelectorAll('.chat-session-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.chat-session-del-btn')) return;
      const sId = el.getAttribute('data-session-id');
      if (sId) {
        setActiveChatSessionId(sId);
        renderActiveChatSession();
      }
    });
  });

  // Delete session
  container.querySelectorAll('.chat-session-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sId = btn.getAttribute('data-del-id');
      if (sId && confirm('Hapus percakapan ini?')) {
        deleteChatSession(sId);
        renderChatSidebar();
        renderActiveChatSession();
        showToast('Percakapan dihapus.');
      }
    });
  });
}

/**
 * Renders the active chat messages and header settings.
 */
export function renderActiveChatSession() {
  const session = getActiveChatSession();
  if (!session) return;

  const titleInput = document.getElementById('chatSessionTitleInput');
  const modeSelect = document.getElementById('chatModeSelect');
  const stream = document.getElementById('chatThreadStream');

  if (titleInput) titleInput.value = session.title || 'New Conversation';
  if (modeSelect) modeSelect.value = session.mode || 'coder';

  if (!stream) return;

  const messages = session.messages || [];
  if (messages.length === 0) {
    stream.innerHTML = `
      <div class="empty-state-sm" style="margin: auto; text-align: center; color: var(--text-tertiary); padding: 3rem 1rem;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem;">💬</span>
        <h4 style="color: var(--text-primary); margin-bottom: 0.35rem;">Percakapan Baru</h4>
        <p style="font-size: 0.88rem; margin: 0; color: var(--text-secondary);">Mulai mengobrol atau minta AI membuatkan web HTML, kode program, atau artikel.</p>
      </div>
    `;
    return;
  }

  stream.innerHTML = messages.map((msg, idx) => {
    const isUser = msg.role === 'user';
    const isLast = idx === messages.length - 1;

    const thinkingHtml = !isUser ? renderThinkingBox(msg.reasoning) : '';

    let bodyHtml = '';
    if (!isUser && msg.isReasoningOnly) {
      bodyHtml = `
        <div class="chat-truncated-note">
          <span>⚠️ Model menghabiskan batas token di proses berpikir sebelum menulis hasil akhir.</span>
        </div>
      `;
    } else {
      bodyHtml = `<div class="chat-bubble-content">${formatRichMarkdown(msg.content)}</div>`;
    }

    let continueHtml = '';
    if (!isUser && isLast && (msg.truncated || msg.isReasoningOnly)) {
      const btnLabel = msg.isReasoningOnly ? '⏩ Lanjutkan ke Hasil Akhir' : '⏩ Lanjutkan Jawaban (Terpotong)';
      continueHtml = `
        <div class="chat-continue-bar">
          <span class="chat-truncated-badge">Teks terpotong batas token</span>
          <button type="button" class="btn btn-primary btn-xs btn-continue-generation" data-reasoning-only="${msg.isReasoningOnly ? '1' : '0'}">${btnLabel}</button>
        </div>
      `;
    }

    return `
      <div class="chat-message-row ${isUser ? 'user-row' : 'assistant-row'}">
        <div class="chat-avatar">${isUser ? '👤' : '⚡'}</div>
        <div class="chat-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}">
          ${thinkingHtml}
          ${bodyHtml}
          ${continueHtml}
        </div>
      </div>
    `;
  }).join('');

  // Wire Copy Code buttons
  stream.querySelectorAll('.btn-copy-code').forEach(btn => {
    btn.addEventListener('click', () => {
      const codeBlock = btn.closest('.code-block-wrapper')?.querySelector('code');
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.innerText);
        showToast('Kode berhasil disalin!');
      }
    });
  });

  // Wire Live Preview HTML buttons
  stream.querySelectorAll('.btn-preview-html').forEach(btn => {
    btn.addEventListener('click', () => {
      const codeBlock = btn.closest('.code-block-wrapper')?.querySelector('code');
      if (codeBlock) {
        openHtmlPreviewModal(codeBlock.innerText);
      }
    });
  });

  // Wire Continue Generation buttons
  stream.querySelectorAll('.btn-continue-generation').forEach(btn => {
    btn.addEventListener('click', () => {
      const wasReasoningOnly = btn.getAttribute('data-reasoning-only') === '1';
      const prompt = wasReasoningOnly
        ? 'Langsung tuliskan hasil akhir / kode lengkapnya sekarang tanpa panjang lebar berpikir.'
        : 'Lanjutkan persis dari karakter terakhir yang terpotong sebelumnya tanpa mengulang dari awal.';
      sendGeneralChatMessage(prompt);
    });
  });

  stream.scrollTop = stream.scrollHeight;
}

/**
 * Sends a chat message to the active BYOK provider.
 * @param {string|null} [overrideText=null]
 */
export async function sendGeneralChatMessage(overrideText = null) {
  if (isGenerating) return;

  const input = document.getElementById('chatThreadInput');
  const userText = (typeof overrideText === 'string' ? overrideText : (input?.value || '')).trim();
  if (!userText) return;

  const session = getActiveChatSession();
  const providerInfo = getActiveProviderInfo();

  // Guard: Zero-key state
  if (!providerInfo.hasKey && providerInfo.provider !== 'custom' && providerInfo.provider !== 'ninerouter') {
    const stream = document.getElementById('chatThreadStream');
    if (stream) {
      const banner = document.createElement('div');
      banner.className = 'chat-message-row assistant-row';
      banner.innerHTML = `
        <div class="chat-avatar">⚡</div>
        <div class="chat-bubble assistant-bubble" style="border-color: #f59e0b; background: rgba(245, 158, 11, 0.08);">
          <strong style="color: #f59e0b;">Kunci API Belum Dikonfigurasi</strong>
          <p style="margin: 0.35rem 0 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">Masukkan API Key gratis Anda (Groq / Gemini / OpenRouter / 9Router) untuk mulai chatting secara penuh.</p>
          <button type="button" class="btn btn-primary btn-xs" id="chatOpenByokModalBtn">⚡ Atur API Key Sekarang</button>
        </div>
      `;
      stream.appendChild(banner);
      stream.scrollTop = stream.scrollHeight;
      document.getElementById('chatOpenByokModalBtn')?.addEventListener('click', openAIModal);
    }
    return;
  }

  // Clear input
  if (input && typeof overrideText !== 'string') {
    input.value = '';
  }

  const now = new Date().toISOString();
  const userMsg = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: userText,
    timestamp: now
  };

  const updatedMessages = [...(session.messages || []), userMsg];
  saveChatSession({
    id: session.id,
    messages: updatedMessages
  });
  renderActiveChatSession();

  // Auto-generate session title from first user message if default
  if (session.title === 'New Conversation' && userText) {
    const autoTitle = userText.length > 28 ? userText.slice(0, 25) + '...' : userText;
    saveChatSession({ id: session.id, title: autoTitle });
    renderChatSidebar();
  }

  // Real-time live streaming assistant row
  const shortModelName = (providerInfo.model || '').split('/').pop().replace(':free', '');
  const stream = document.getElementById('chatThreadStream');
  const liveEl = document.createElement('div');
  liveEl.className = 'chat-message-row assistant-row live-streaming';
  liveEl.id = 'chatLiveAssistantRow';
  liveEl.innerHTML = `
    <div class="chat-avatar">⚡</div>
    <div class="chat-bubble assistant-bubble">
      <div class="chat-stream-header" style="font-size: 0.76rem; color: var(--text-tertiary); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
        <span class="chat-stream-dot" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981;"></span>
        <span>Pecut AI (${escapeHtml(providerInfo.name)} • ${escapeHtml(shortModelName)})</span>
      </div>
      <div class="chat-live-thinking"></div>
      <div class="chat-bubble-content chat-live-content">
        <em style="color: var(--text-tertiary); font-size: 0.88rem;">Menghubungkan ke AI...</em>
      </div>
    </div>
  `;
  if (stream) {
    stream.appendChild(liveEl);
    stream.scrollTop = stream.scrollHeight;
  }

  isGenerating = true;
  const sendBtn = document.getElementById('chatThreadSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const currentMode = CHAT_MODES[session.mode] || CHAT_MODES.coder;
    const systemPrompt = currentMode.systemPrompt;

    // Send clean, token-bounded history (excludes errors, welcome banners, and runaway contexts)
    const historyPayload = buildCleanHistoryPayload(updatedMessages, 10, 16000);

    let renderPending = false;
    let latestStreamData = null;

    const flushStreamUI = () => {
      if (!latestStreamData || !liveEl.isConnected) return;
      const { text, reasoning } = latestStreamData;
      const thinkingContainer = liveEl.querySelector('.chat-live-thinking');
      const contentContainer = liveEl.querySelector('.chat-live-content');

      if (thinkingContainer && reasoning) {
        thinkingContainer.innerHTML = renderThinkingBox(reasoning);
      }
      if (contentContainer && text) {
        contentContainer.innerHTML = formatRichMarkdown(text);
      }

      if (stream) {
        const isNearBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 150;
        if (isNearBottom) {
          stream.scrollTop = stream.scrollHeight;
        }
      }
    };

    const onChunk = (chunkData) => {
      latestStreamData = chunkData;
      if (!renderPending) {
        renderPending = true;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            renderPending = false;
            flushStreamUI();
          });
        } else {
          renderPending = false;
          flushStreamUI();
        }
      }
    };

    const response = await completeChat({
      systemPrompt,
      messages: historyPayload,
      temperature: 0.4,
      maxTokens: 8192,
      onChunk
    });

    liveEl.remove();

    const assistantMsg = {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content: response.isReasoningOnly ? '' : response.text,
      reasoning: response.reasoning || '',
      truncated: Boolean(response.truncated),
      isReasoningOnly: Boolean(response.isReasoningOnly),
      model: response.model,
      timestamp: new Date().toISOString()
    };

    saveChatSession({
      id: session.id,
      messages: [...updatedMessages, assistantMsg]
    });
    renderActiveChatSession();
  } catch (err) {
    liveEl.remove();
    showToast(`Error: ${err.message}`, 4000);

    const errorMsg = {
      id: 'msg_err_' + Date.now(),
      role: 'assistant',
      isError: true,
      content: `⚠️ **Gagal mendapatkan respon dari AI:** ${err.message}\n\nSilakan periksa koneksi atau coba model lain di pengaturan AI.`,
      timestamp: new Date().toISOString()
    };

    saveChatSession({
      id: session.id,
      messages: [...updatedMessages, errorMsg]
    });
    renderActiveChatSession();
  } finally {
    isGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

/**
 * Initializes the full-featured AI Chat Playground.
 */
export function initAIChat() {
  registerViewHandler('chat', () => {
    renderChatSidebar();
    renderActiveChatSession();
  });

  renderChatSidebar();
  renderActiveChatSession();

  // Delegated click handlers for code copying and HTML live preview
  const threadStream = document.getElementById('chatThreadStream');
  if (threadStream) {
    threadStream.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.btn-copy-code');
      if (copyBtn) {
        const codeBlock = copyBtn.closest('.code-block-wrapper')?.querySelector('code');
        if (codeBlock) {
          navigator.clipboard.writeText(codeBlock.innerText);
          showToast('Kode berhasil disalin!');
        }
        return;
      }
      const previewBtn = e.target.closest('.btn-preview-html');
      if (previewBtn) {
        const codeBlock = previewBtn.closest('.code-block-wrapper')?.querySelector('code');
        if (codeBlock) {
          openHtmlPreviewModal(codeBlock.innerText);
        }
        return;
      }
    });
  }

  const startNewChat = () => {
    const modeSelect = document.getElementById('chatModeSelect');
    const currentMode = modeSelect ? modeSelect.value : 'coder';
    createChatSession('New Conversation', currentMode);
    renderChatSidebar();
    renderActiveChatSession();
    document.getElementById('chatThreadInput')?.focus();
  };

  // "+ New Chat" buttons (sidebar & header)
  const newChatBtn = document.getElementById('chatNewSessionBtn');
  if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

  const headerNewBtn = document.getElementById('chatHeaderNewBtn');
  if (headerNewBtn) headerNewBtn.addEventListener('click', startNewChat);

  // "Clear Chat" button in header
  const clearSessionBtn = document.getElementById('chatClearSessionBtn');
  if (clearSessionBtn) {
    clearSessionBtn.addEventListener('click', () => {
      const session = getActiveChatSession();
      if (!session || !session.messages || session.messages.length === 0) {
        showToast('Chat sudah bersih.');
        return;
      }
      if (confirm('Bersihkan semua sisa pesan di percakapan ini?')) {
        clearActiveChatSession();
        renderChatSidebar();
        renderActiveChatSession();
        showToast('Riwayat percakapan ini telah dibersihkan.');
        document.getElementById('chatThreadInput')?.focus();
      }
    });
  }

  // Auto-start fresh chat when user switches AI provider or model
  if (typeof window !== 'undefined') {
    window.addEventListener('pecut:ai-config-changed', (e) => {
      const { nextConfig, modelChanged, startFreshChat } = e.detail || {};
      if (!modelChanged || !startFreshChat) return;

      const session = getActiveChatSession();
      const hasUserMessages = session?.messages?.some(m => m.role === 'user');
      if (hasUserMessages) {
        createChatSession('New Conversation', session.mode || 'coder');
        renderChatSidebar();
        renderActiveChatSession();
        const shortModel = (nextConfig?.model || '').split('/').pop().replace(':free', '');
        showToast(`Model diganti ke ${shortModel || nextConfig?.provider} — chat baru dimulai (chat lama tersimpan di ☰ Chats).`, 4000);
      } else {
        showToast('Pengaturan AI & model berhasil disimpan!');
      }
    });
  }

  // Session title edit
  const titleInput = document.getElementById('chatSessionTitleInput');
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      const session = getActiveChatSession();
      saveChatSession({
        id: session.id,
        title: titleInput.value.trim() || 'Conversation'
      });
      renderChatSidebar();
    });
  }

  // Mode select change
  const modeSelect = document.getElementById('chatModeSelect');
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      const session = getActiveChatSession();
      saveChatSession({
        id: session.id,
        mode: modeSelect.value
      });
      renderChatSidebar();
      showToast(`Mode percakapan diubah ke: ${CHAT_MODES[modeSelect.value]?.name || modeSelect.value}`);
    });
  }

  // Send message
  const sendBtn = document.getElementById('chatThreadSendBtn');
  const input = document.getElementById('chatThreadInput');

  if (sendBtn) {
    sendBtn.addEventListener('click', () => sendGeneralChatMessage());
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendGeneralChatMessage();
      }
    });
  }

  // Toggle chat sessions sidebar on mobile/tablet
  const toggleSidebarBtn = document.getElementById('chatToggleSidebarBtn');
  const sidebar = document.getElementById('chatSessionsSidebar');
  if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }
}
