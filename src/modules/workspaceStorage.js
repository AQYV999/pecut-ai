/**
 * Pecut AI — Workspace & Canvas Storage Module
 * Apache-2.0 License
 *
 * Manages multi-project canvas states, chat messages, and document content.
 * 100% client-side in browser localStorage (Zero backend database cost).
 */

export const STORAGE_KEY = 'pecut_workspaces';

function generateId() {
  return 'ws_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function createStarterWorkspace() {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: 'Starter Prompt Project',
    createdAt: now,
    updatedAt: now,
    documentContent: `# Pecut AI — Master Prompt Workspace

## Role & Goal
You are a world-class AI Prompt Architect. Your objective is to create clear, high-performing prompts with explicit constraints and structured outputs.

## Context
Use this Canvas document as your live draft. When chatting with AI on the left, you can ask for adjustments, and click "📥 Apply to Canvas" to update this document in real time.

## Instructions
1. Define the primary role and target audience.
2. Provide step-by-step guidance.
3. Enforce strict constraints and guardrails.

## Output Format
- Deliver response in clean Markdown.
- Include structured examples and validation criteria.`,
    messages: [
      {
        id: 'msg_welcome',
        role: 'assistant',
        content: `👋 **Selamat datang di Pecut AI Workspace Canvas!**

Ini adalah lembar kerja interaktif Anda:
- Di **sisi kiri (Chat)**: Anda bisa mendiskusikan ide prompt, meminta revisi spesifik, atau brainstorming dengan AI.
- Di **sisi kanan (Kanvas)**: Draf dokumen prompt utama Anda. Anda bisa mengetik langsung di sini atau klik **"📥 Terapkan ke Kanvas"** dari pesan AI.

Ketik ide prompt Anda di bawah untuk mulai berkolaborasi!`,
        timestamp: now
      }
    ],
    contextProfileId: ''
  };
}

/**
 * Loads all workspaces and the active workspace pointer from localStorage.
 * Auto-initializes starter workspace if storage is empty.
 * @returns {{ activeWorkspaceId: string, workspaces: Array<Object> }}
 */
export function loadWorkspaces() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.workspaces) && parsed.workspaces.length > 0) {
        let activeId = parsed.activeWorkspaceId;
        const exists = parsed.workspaces.some(w => w.id === activeId);
        if (!exists) {
          activeId = parsed.workspaces[0].id;
        }
        return {
          activeWorkspaceId: activeId,
          workspaces: parsed.workspaces
        };
      }
    }
  } catch (_) {
    // fallback if corrupted
  }

  // Initialize starter state
  const starter = createStarterWorkspace();
  const initialData = {
    activeWorkspaceId: starter.id,
    workspaces: [starter]
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
}

/**
 * Persists workspaces state directly to localStorage.
 * @param {{ activeWorkspaceId: string, workspaces: Array<Object> }} state
 */
export function persistWorkspaces(state) {
  if (!state || !Array.isArray(state.workspaces)) return;
  // Guard: if empty, re-seed
  if (state.workspaces.length === 0) {
    const starter = createStarterWorkspace();
    state.workspaces = [starter];
    state.activeWorkspaceId = starter.id;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Retrieves the currently active workspace object.
 * @returns {Object}
 */
export function getActiveWorkspace() {
  const state = loadWorkspaces();
  const found = state.workspaces.find(w => w.id === state.activeWorkspaceId);
  return found || state.workspaces[0];
}

/**
 * Changes the active workspace pointer.
 * @param {string} id
 */
export function setActiveWorkspaceId(id) {
  const state = loadWorkspaces();
  if (state.workspaces.some(w => w.id === id)) {
    state.activeWorkspaceId = id;
    persistWorkspaces(state);
  }
}

/**
 * Creates and saves a new workspace, setting it as active.
 * @param {string} [title]
 * @param {string} [initialDoc]
 * @returns {Object}
 */
export function createWorkspace(title = 'Untitled Prompt', initialDoc = '') {
  const state = loadWorkspaces();
  const now = new Date().toISOString();
  const newWs = {
    id: generateId(),
    title: (title || 'Untitled Prompt').trim(),
    createdAt: now,
    updatedAt: now,
    documentContent: initialDoc || '',
    messages: [],
    contextProfileId: ''
  };

  state.workspaces.unshift(newWs);
  state.activeWorkspaceId = newWs.id;
  persistWorkspaces(state);
  return newWs;
}

/**
 * Saves updates to an existing workspace (title, doc content, messages, profile).
 * @param {Object} partialItem
 * @returns {Object}
 */
export function saveWorkspace(partialItem) {
  if (!partialItem || !partialItem.id) return null;
  const state = loadWorkspaces();
  const index = state.workspaces.findIndex(w => w.id === partialItem.id);

  if (index === -1) return null;

  const existing = state.workspaces[index];
  const updated = {
    ...existing,
    ...partialItem,
    updatedAt: new Date().toISOString()
  };

  // Bound persisted messages to latest 50 to prevent quota issues
  if (Array.isArray(updated.messages) && updated.messages.length > 50) {
    updated.messages = updated.messages.slice(-50);
  }

  state.workspaces[index] = updated;
  persistWorkspaces(state);
  return updated;
}

/**
 * Deletes a workspace by ID.
 * Falls back to another workspace if the active one was deleted.
 * @param {string} id
 * @returns {{ activeWorkspaceId: string, workspaces: Array<Object> }}
 */
export function deleteWorkspace(id) {
  const state = loadWorkspaces();
  const filtered = state.workspaces.filter(w => w.id !== id);

  state.workspaces = filtered;
  if (state.activeWorkspaceId === id) {
    state.activeWorkspaceId = filtered.length > 0 ? filtered[0].id : null;
  }

  persistWorkspaces(state);
  return loadWorkspaces();
}

/**
 * Exports all workspaces as a JSON backup string.
 * @returns {string}
 */
export function exportWorkspacesJSON() {
  const state = loadWorkspaces();
  return JSON.stringify(state, null, 2);
}

/**
 * Imports workspaces from a JSON string, validating the schema.
 * @param {string} jsonString
 * @returns {boolean}
 */
export function importWorkspacesJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.workspaces) || parsed.workspaces.length === 0) {
      return false;
    }

    // Validate that each workspace has minimum required fields
    const validWorkspaces = parsed.workspaces.filter(w => w && typeof w.id === 'string' && typeof w.title === 'string');
    if (validWorkspaces.length === 0) return false;

    const activeId = validWorkspaces.some(w => w.id === parsed.activeWorkspaceId)
      ? parsed.activeWorkspaceId
      : validWorkspaces[0].id;

    persistWorkspaces({
      activeWorkspaceId: activeId,
      workspaces: validWorkspaces
    });
    return true;
  } catch (_) {
    return false;
  }
}
