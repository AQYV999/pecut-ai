/**
 * Pecut AI — Full-Featured AI Chat & Code Playground
 * Apache-2.0 License
 *
 * General conversational AI interface (like Hermes, Claude, and OpenCoder)
 * with multi-session management, live HTML preview, and direct instruction following.
 */

import { completeChat, getActiveProviderInfo } from '../services/ai/client.js';
import { openAIModal } from './aiModal.js';
import { showToast, escapeHtml } from '../utils/helpers.js';
import { registerViewHandler } from './navigation.js';

export const CHAT_STORAGE_KEY = 'pecut_chat_sessions';

export const CHAT_MODES = {
  coder: {
    id: 'coder',
    name: 'OpenCoder & Software Engineer',
    badge: 'Coding Specialist',
    icon: '💻',
    systemPrompt: `You are Pecut AI OpenCoder, an elite fullstack software engineer and coding assistant (inspired by Hermes and OpenCoder).
When the user asks for code, scripts, HTML/CSS/JS, databases, or fixes:
1. Provide the complete, clean, production-ready implementation directly in markdown code blocks.
2. If building a website or UI component, provide a self-contained, working HTML document with embedded CSS and JavaScript so it runs instantly.
3. Be direct, concise, and explain key parts without unnecessary fluff.`
  },
  webdev: {
    id: 'webdev',
    name: 'Web Designer & HTML/CSS Specialist',
    badge: 'Web Architect',
    icon: '🌐',
    systemPrompt: `You are Pecut AI Web Architect, an expert frontend designer and web builder.
When the user asks you to build a website, landing page, interactive tool, or web component:
1. Deliver a complete, fully functional HTML file with modern responsive CSS (Flexbox/Grid, gradients, smooth styling) and interactive JavaScript.
2. Make the visual design stunning, responsive, and mobile-friendly.
3. Wrap the HTML inside a \`\`\`html code block so the user can preview it directly.`
  },
  general: {
    id: 'general',
    name: 'General Assistant (Hermes Mode)',
    badge: 'Universal AI',
    icon: '⚡',
    systemPrompt: `You are Pecut AI, a versatile, honest, and highly capable general artificial intelligence assistant (inspired by Hermes).
Directly follow whatever the user asks:
- If asked for code or HTML, write the complete code.
- If asked for analysis, writing, translation, or conversation, answer thoroughly and naturally.
- Always be helpful, objective, and accurate.`
  },
  prompt: {
    id: 'prompt',
    name: 'Prompt Engineer Specialist',
    badge: 'Prompt Craft',
    icon: '🎯',
    systemPrompt: `You are Pecut AI Senior Prompt Engineer. Your specialty is helping users brainstorm, draft, and refine high-performance prompts with structured roles, objectives, and constraints.`
  }
};

let isGenerating = false;

function generateId() {
  return 'cs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function createStarterChatSession() {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: 'New Conversation',
    mode: 'coder',
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: 'msg_welcome',
        role: 'assistant',
        content: `👋 **Halo! Saya Pecut AI Chat Assistant.**

Saya siap membantu Anda membuat kode program, web HTML/CSS/JS lengkap, menjawab pertanyaan teknis, atau mendiskusikan apa pun seperti AI pada umumnya (Hermes / OpenCoder).

💡 *Coba ketik:*
- *"Buatkan aku web HTML game snake lengkap dengan CSS & JavaScript"*
- *"Bikin kalkulator modern dengan HTML dan CSS"*
- *"Buatkan skrip Python untuk analisis data"*

Silakan ketik perintah Anda di bawah!`,
        timestamp: now
      }
    ]
  };
}

/**
 * Loads all chat sessions from localStorage.
 * @returns {{ activeSessionId: string, sessions: Array<Object> }}
 */
export function loadChatSessions() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
        let activeId = parsed.activeSessionId;
        const exists = parsed.sessions.some(s => s.id === activeId);
        if (!exists) activeId = parsed.sessions[0].id;
        return {
          activeSessionId: activeId,
          sessions: parsed.sessions
        };
      }
    }
  } catch (_) {}

  const starter = createStarterChatSession();
  const initial = {
    activeSessionId: starter.id,
    sessions: [starter]
  };
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export function persistChatSessions(state) {
  if (!state || !Array.isArray(state.sessions)) return;
  if (state.sessions.length === 0) {
    const starter = createStarterChatSession();
    state.sessions = [starter];
    state.activeSessionId = starter.id;
  }
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
}

export function getActiveChatSession() {
  const state = loadChatSessions();
  const found = state.sessions.find(s => s.id === state.activeSessionId);
  return found || state.sessions[0];
}

export function setActiveChatSessionId(id) {
  const state = loadChatSessions();
  if (state.sessions.some(s => s.id === id)) {
    state.activeSessionId = id;
    persistChatSessions(state);
  }
}

export function createChatSession(title = 'New Conversation', mode = 'coder') {
  const state = loadChatSessions();
  const now = new Date().toISOString();
  const newSession = {
    id: generateId(),
    title: (title || 'New Conversation').trim(),
    mode: mode || 'coder',
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  state.sessions.unshift(newSession);
  state.activeSessionId = newSession.id;
  persistChatSessions(state);
  return newSession;
}

export function saveChatSession(partial) {
  if (!partial || !partial.id) return null;
  const state = loadChatSessions();
  const idx = state.sessions.findIndex(s => s.id === partial.id);
  if (idx === -1) return null;

  const existing = state.sessions[idx];
  const updated = {
    ...existing,
    ...partial,
    updatedAt: new Date().toISOString()
  };

  // Bound persisted messages to latest 60
  if (Array.isArray(updated.messages) && updated.messages.length > 60) {
    updated.messages = updated.messages.slice(-60);
  }

  state.sessions[idx] = updated;
  persistChatSessions(state);
  return updated;
}

export function deleteChatSession(id) {
  const state = loadChatSessions();
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.activeSessionId === id) {
    state.activeSessionId = state.sessions.length > 0 ? state.sessions[0].id : null;
  }
  persistChatSessions(state);
  return loadChatSessions();
}

/**
 * Checks if a text contains runnable HTML code and extracts it.
 * @param {string} text
 * @returns {string|null}
 */
export function extractHtmlCode(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Look for ```html ... ``` code fences
  const fenceRegex = /```html\n([\s\S]*?)```/i;
  const match = text.match(fenceRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // 2. Look for <!DOCTYPE html> or <html> tags
  if (text.includes('<!DOCTYPE html>') || (text.includes('<html') && text.includes('</html>'))) {
    const start = text.indexOf('<!DOCTYPE') !== -1 ? text.indexOf('<!DOCTYPE') : text.indexOf('<html');
    const end = text.lastIndexOf('</html>');
    if (end > start) {
      return text.slice(start, end + 7).trim();
    }
  }

  return null;
}

/**
 * Basic markdown-to-HTML formatter with code syntax block extraction.
 * @param {string} text
 * @returns {string}
 */
export function formatMarkdown(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);

  // Fenced code blocks with language badge, copy button, and HTML preview if applicable
  const withCode = escaped.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
    const rawCode = code.trim();
    const isHtml = (lang || '').toLowerCase() === 'html' || rawCode.startsWith('&lt;!DOCTYPE') || rawCode.startsWith('&lt;html');
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang-tag">${escapeHtml(lang || 'code')}</span>
          <div class="code-header-actions">
            ${isHtml ? `
              <button type="button" class="btn btn-primary btn-xs btn-preview-html" title="Buka preview live website">
                <span>▶️ Live Preview</span>
              </button>
            ` : ''}
            <button type="button" class="btn btn-ghost btn-xs btn-copy-code" title="Salin kode">
              <span>📋 Copy</span>
            </button>
          </div>
        </div>
        <pre><code class="language-${lang}">${rawCode}</code></pre>
      </div>
    `;
  });

  // Inline code `...`
  const withInline = withCode.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold **...**
  const withBold = withInline.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Paragraphs
  return withBold.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
}

/**
 * Opens a modal with a sandboxed iframe to live preview generated HTML.
 * @param {string} htmlCode
 */
export function openHtmlPreviewModal(htmlCode) {
  let modal = document.getElementById('chatHtmlPreviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'chatHtmlPreviewModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 95vw; width: 1200px; height: 90vh; display: flex; flex-direction: column; padding: 0;">
        <div class="modal-header" style="padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--surface-border); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">🌐 Live HTML Web Preview</span>
            <span class="badge-pro" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">Interactive Sandbox</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary btn-xs" id="chatPreviewNewTabBtn" title="Buka di Tab Baru">↗ Buka di Tab Baru</button>
            <button type="button" class="btn btn-ghost btn-sm" id="chatPreviewCloseBtn">✕</button>
          </div>
        </div>
        <div style="flex: 1; background: #ffffff; position: relative;">
          <iframe id="chatHtmlPreviewFrame" sandbox="allow-scripts allow-modals" style="width: 100%; height: 100%; border: none;"></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('chatPreviewCloseBtn')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    document.getElementById('chatPreviewNewTabBtn')?.addEventListener('click', () => {
      const frame = document.getElementById('chatHtmlPreviewFrame');
      if (frame && frame.srcdoc) {
        const win = window.open();
        if (win) {
          win.document.open();
          win.document.write(frame.srcdoc);
          win.document.close();
        }
      }
    });
  }

  const frame = document.getElementById('chatHtmlPreviewFrame');
  if (frame) {
    frame.srcdoc = htmlCode;
  }
  modal.classList.add('active');
}

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

  stream.innerHTML = messages.map(msg => {
    const isUser = msg.role === 'user';
    const isAssistant = msg.role === 'assistant';

    return `
      <div class="chat-message-row ${isUser ? 'user-row' : 'assistant-row'}">
        <div class="chat-avatar">${isUser ? '👤' : '⚡'}</div>
        <div class="chat-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}">
          <div class="chat-bubble-content">${formatMarkdown(msg.content)}</div>
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

  stream.scrollTop = stream.scrollHeight;
}

/**
 * Sends a chat message to the active BYOK provider.
 */
export async function sendGeneralChatMessage() {
  if (isGenerating) return;

  const input = document.getElementById('chatThreadInput');
  if (!input) return;
  const userText = input.value.trim();
  if (!userText) return;

  const session = getActiveChatSession();
  const providerInfo = getActiveProviderInfo();

  // Guard: Zero-key state
  if (!providerInfo.hasKey && providerInfo.provider !== 'custom') {
    const stream = document.getElementById('chatThreadStream');
    if (stream) {
      const banner = document.createElement('div');
      banner.className = 'chat-message-row assistant-row';
      banner.innerHTML = `
        <div class="chat-avatar">⚡</div>
        <div class="chat-bubble assistant-bubble" style="border-color: #f59e0b; background: rgba(245, 158, 11, 0.08);">
          <strong style="color: #f59e0b;">Kunci API Belum Dikonfigurasi</strong>
          <p style="margin: 0.35rem 0 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">Masukkan API Key gratis Anda (Groq / Gemini) untuk mulai chatting secara penuh.</p>
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
  input.value = '';

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

  // Typing indicator
  const stream = document.getElementById('chatThreadStream');
  const typingEl = document.createElement('div');
  typingEl.className = 'chat-message-row assistant-row typing-indicator';
  typingEl.id = 'chatThreadTyping';
  typingEl.innerHTML = `
    <div class="chat-avatar">⚡</div>
    <div class="chat-bubble assistant-bubble" style="opacity: 0.7;">
      <em>Pecut AI (${escapeHtml(providerInfo.name)}) sedang merespon...</em>
    </div>
  `;
  if (stream) {
    stream.appendChild(typingEl);
    stream.scrollTop = stream.scrollHeight;
  }

  isGenerating = true;
  const sendBtn = document.getElementById('chatThreadSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const currentMode = CHAT_MODES[session.mode] || CHAT_MODES.coder;
    const systemPrompt = currentMode.systemPrompt;

    // Send bounded history (last 12 turns)
    const historyPayload = updatedMessages.slice(-12).map(m => ({
      role: m.role,
      content: m.content
    }));

    const response = await completeChat({
      systemPrompt,
      messages: historyPayload,
      temperature: 0.4
    });

    document.getElementById('chatThreadTyping')?.remove();

    const assistantMsg = {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content: response.text,
      timestamp: new Date().toISOString()
    };

    saveChatSession({
      id: session.id,
      messages: [...updatedMessages, assistantMsg]
    });
    renderActiveChatSession();
  } catch (err) {
    document.getElementById('chatThreadTyping')?.remove();
    showToast(`Error: ${err.message}`, 4000);

    const errorMsg = {
      id: 'msg_err_' + Date.now(),
      role: 'assistant',
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

  // "+ New Chat" button
  const newChatBtn = document.getElementById('chatNewSessionBtn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      const modeSelect = document.getElementById('chatModeSelect');
      const currentMode = modeSelect ? modeSelect.value : 'coder';
      createChatSession('New Conversation', currentMode);
      renderChatSidebar();
      renderActiveChatSession();
      document.getElementById('chatThreadInput')?.focus();
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
    sendBtn.addEventListener('click', sendGeneralChatMessage);
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
