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
  loadChatSessions,
  createChatSession,
  saveChatSession,
  deleteChatSession,
  clearActiveChatSession,
  buildCleanHistoryPayload,
  formatMarkdown,
  getActiveChatSession,
  setActiveChatSessionId,
  extractHtmlCode,
  CHAT_MODES
} = await import('../src/modules/chat.js');

test('loadChatSessions auto-initializes starter chat session if empty', () => {
  storageStore.clear();
  const state = loadChatSessions();
  assert.ok(state.sessions.length >= 1);
  assert.equal(state.activeSessionId, state.sessions[0].id);
  assert.ok(state.sessions[0].title);
});

test('createChatSession creates new chat session and sets as active', () => {
  storageStore.clear();
  const s = createChatSession('Coding Project', 'coder');
  assert.ok(s.id);
  assert.equal(s.title, 'Coding Project');
  assert.equal(s.mode, 'coder');
  assert.equal(getActiveChatSession().id, s.id);
});

test('saveChatSession updates session title and messages', () => {
  storageStore.clear();
  const s = createChatSession('New Topic', 'general');
  const updated = saveChatSession({
    id: s.id,
    title: 'Renamed Topic',
    messages: [{ id: '1', role: 'user', content: 'Halo' }]
  });
  assert.equal(updated.title, 'Renamed Topic');
  assert.equal(updated.messages.length, 1);
  assert.equal(getActiveChatSession().title, 'Renamed Topic');
});

test('deleteChatSession removes session and falls back to another', () => {
  storageStore.clear();
  const s1 = createChatSession('Chat 1');
  const s2 = createChatSession('Chat 2');
  assert.equal(getActiveChatSession().id, s2.id);

  const state = deleteChatSession(s2.id);
  assert.equal(state.activeSessionId, s1.id);
  assert.equal(state.sessions.some(s => s.id === s2.id), false);
});

test('extractHtmlCode extracts valid HTML from code fences', () => {
  const markdown = 'Here is your website:\n```html\n<!DOCTYPE html>\n<html><body><h1>Hello World</h1></body></html>\n```\nEnjoy!';
  const html = extractHtmlCode(markdown);
  assert.ok(html);
  assert.ok(html.includes('<h1>Hello World</h1>'));
});

test('extractHtmlCode extracts plain HTML if code fences missing but tags present', () => {
  const plainHtml = '<!DOCTYPE html><html><body><p>Test</p></body></html>';
  const html = extractHtmlCode(plainHtml);
  assert.ok(html);
  assert.ok(html.includes('<p>Test</p>'));
});

test('extractHtmlCode returns null if no HTML detected', () => {
  const code = '```python\nprint("hello")\n```';
  assert.equal(extractHtmlCode(code), null);
});

test('CHAT_MODES provides system prompts for coder, webdev, and general', () => {
  assert.ok(CHAT_MODES.coder);
  assert.ok(CHAT_MODES.webdev);
  assert.ok(CHAT_MODES.general);
  assert.ok(CHAT_MODES.coder.systemPrompt.includes('code'));
});

test('clearActiveChatSession wipes messages and resets title', () => {
  storageStore.clear();
  const s = createChatSession('Old Chat');
  saveChatSession({
    id: s.id,
    messages: [{ id: '1', role: 'user', content: 'old message' }]
  });
  assert.equal(getActiveChatSession().messages.length, 1);

  clearActiveChatSession();
  const cleared = getActiveChatSession();
  assert.equal(cleared.messages.length, 0);
  assert.equal(cleared.title, 'New Conversation');
});

test('buildCleanHistoryPayload filters out welcome, errors, and respects char budget', () => {
  const msgs = [
    { id: 'msg_welcome', role: 'assistant', content: 'Welcome!' },
    { id: 'u1', role: 'user', content: 'A'.repeat(200) },
    { id: 'msg_err_1', role: 'assistant', content: 'Error happened' },
    { id: 'e2', role: 'assistant', isError: true, content: 'Another error' },
    { id: 'u2', role: 'user', content: 'Hello new model' }
  ];

  const payload = buildCleanHistoryPayload(msgs, 10, 100);
  assert.equal(payload.length, 1);
  assert.equal(payload[0].content, 'Hello new model');

  const fullPayload = buildCleanHistoryPayload(msgs, 10, 5000);
  assert.equal(fullPayload.length, 2);
  assert.equal(fullPayload[0].content, 'A'.repeat(200));
  assert.equal(fullPayload[1].content, 'Hello new model');
});

test('formatMarkdown gracefully closes truncated code fences', () => {
  const truncated = 'Here is CSS:\n```css\n.bg { color: red;';
  const html = formatMarkdown(truncated);
  assert.ok(html.includes('code-block-wrapper'));
  assert.ok(html.includes('.bg { color: red;'));
});
