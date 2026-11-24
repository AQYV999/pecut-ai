/**
 * Pecut AI — Chat Session Persistence & History Payload Builder
 * Apache-2.0 License
 */

export const CHAT_STORAGE_KEY = 'pecut_chat_sessions';

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
 * Clears all messages inside the currently active chat session.
 * @returns {Object|null}
 */
export function clearActiveChatSession() {
  const session = getActiveChatSession();
  if (!session) return null;
  return saveChatSession({
    id: session.id,
    title: 'New Conversation',
    messages: []
  });
}

/**
 * Builds a clean, token-bounded history payload for the AI API.
 * Excludes welcome banners, error messages, and prioritizes deliverables over runaway internal thinking traces.
 * @param {Array<Object>} messages
 * @param {number} [maxMessages=20]
 * @param {number} [maxChars=120000]
 * @returns {Array<{ role: string, content: string }>}
 */
export function buildCleanHistoryPayload(messages = [], maxMessages = 20, maxChars = 120000) {
  if (!Array.isArray(messages)) return [];

  const valid = messages.filter(m => {
    if (!m || !m.role) return false;
    const text = (m.content || m.reasoning || '').trim();
    if (!text) return false;
    if (m.isError) return false;
    if (typeof m.id === 'string' && (m.id === 'msg_welcome' || m.id.startsWith('msg_err_'))) return false;
    if (m.role === 'assistant' && text.startsWith('⚠️ **Gagal mendapatkan respon dari AI:**')) return false;
    return m.role === 'user' || m.role === 'assistant';
  });

  const recent = valid.slice(-maxMessages);
  const bounded = [];
  let charTotal = 0;

  // Walk from newest to oldest so recent turns are prioritized
  for (let i = recent.length - 1; i >= 0; i--) {
    const item = recent[i];
    // For assistant messages, prioritize the actual output code/content over internal thinking traces
    const text = String(item.content ? item.content : (item.reasoning || ''));
    if (!text.trim()) continue;

    if (bounded.length > 0 && charTotal + text.length > maxChars) {
      break;
    }
    charTotal += text.length;
    bounded.unshift({ role: item.role, content: text });
  }

  return bounded;
}
