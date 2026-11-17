import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node environment
const storageStore = new Map();
globalThis.localStorage = {
  getItem: (key) => storageStore.get(key) || null,
  setItem: (key, val) => storageStore.set(key, String(val)),
  removeItem: (key) => storageStore.delete(key),
  clear: () => storageStore.clear()
};

const {
  loadWorkspaces,
  saveWorkspace,
  createWorkspace,
  deleteWorkspace,
  setActiveWorkspaceId,
  getActiveWorkspace,
  exportWorkspacesJSON,
  importWorkspacesJSON,
  STORAGE_KEY
} = await import('../src/modules/workspaceStorage.js');

test('loadWorkspaces auto-initializes a default starter workspace if storage is empty', () => {
  storageStore.clear();
  const state = loadWorkspaces();
  assert.ok(state.workspaces.length >= 1, 'Should have at least 1 starter workspace');
  assert.equal(state.activeWorkspaceId, state.workspaces[0].id);
  assert.ok(state.workspaces[0].title);
  assert.ok(state.workspaces[0].documentContent);
});

test('createWorkspace adds a new workspace and sets it as active', () => {
  storageStore.clear();
  const ws = createWorkspace('Marketing Campaign', '# Campaign Objective');
  assert.ok(ws.id);
  assert.equal(ws.title, 'Marketing Campaign');
  assert.equal(ws.documentContent, '# Campaign Objective');
  assert.deepEqual(ws.messages, []);

  const active = getActiveWorkspace();
  assert.equal(active.id, ws.id);
});

test('saveWorkspace updates an existing workspace document and title', () => {
  storageStore.clear();
  const ws = createWorkspace('Draft 1', 'Initial prompt text');
  const updated = saveWorkspace({
    id: ws.id,
    title: 'Draft 1 (Revised)',
    documentContent: 'Updated prompt text with constraints'
  });

  assert.equal(updated.title, 'Draft 1 (Revised)');
  assert.equal(updated.documentContent, 'Updated prompt text with constraints');

  const active = getActiveWorkspace();
  assert.equal(active.title, 'Draft 1 (Revised)');
});

test('deleteWorkspace removes workspace and falls back to remaining workspace or creates new', () => {
  storageStore.clear();
  const ws1 = createWorkspace('Doc 1', 'Content 1');
  const ws2 = createWorkspace('Doc 2', 'Content 2');

  assert.equal(getActiveWorkspace().id, ws2.id);

  // Delete active ws2 -> should fall back to ws1
  const stateAfterDelete = deleteWorkspace(ws2.id);
  assert.equal(stateAfterDelete.workspaces.length, 2); // default starter + ws1
  assert.equal(stateAfterDelete.activeWorkspaceId, ws1.id);

  // If all are deleted, it should auto-create a starter
  stateAfterDelete.workspaces.forEach(w => deleteWorkspace(w.id));
  const finalState = loadWorkspaces();
  assert.ok(finalState.workspaces.length >= 1, 'Should auto-create starter when all deleted');
});

test('setActiveWorkspaceId updates the active workspace pointer', () => {
  storageStore.clear();
  const ws1 = createWorkspace('First', 'Text 1');
  const ws2 = createWorkspace('Second', 'Text 2');

  setActiveWorkspaceId(ws1.id);
  assert.equal(getActiveWorkspace().id, ws1.id);
});

test('exportWorkspacesJSON and importWorkspacesJSON correctly serialize and deserialize', () => {
  storageStore.clear();
  createWorkspace('Project Alpha', 'Alpha prompt');
  const exported = exportWorkspacesJSON();
  assert.ok(typeof exported === 'string');
  assert.ok(exported.includes('Project Alpha'));

  storageStore.clear();
  assert.equal(storageStore.get(STORAGE_KEY), undefined);

  const importResult = importWorkspacesJSON(exported);
  assert.equal(importResult, true);
  const reloaded = loadWorkspaces();
  assert.ok(reloaded.workspaces.some(w => w.title === 'Project Alpha'));
});

test('importWorkspacesJSON rejects invalid JSON string gracefully', () => {
  const result = importWorkspacesJSON('invalid json {{{');
  assert.equal(result, false);
});
