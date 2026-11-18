/**
 * Pecut AI — Full-Featured AI Chat & Code Playground (Facade)
 * Apache-2.0 License
 *
 * Public entry point re-exporting modular chat components for full
 * backward compatibility with app imports and tests.
 */

export { CHAT_MODES } from './chat/modes.js';
export {
  CHAT_STORAGE_KEY,
  loadChatSessions,
  persistChatSessions,
  getActiveChatSession,
  setActiveChatSessionId,
  createChatSession,
  saveChatSession,
  deleteChatSession,
  clearActiveChatSession,
  buildCleanHistoryPayload
} from './chat/storage.js';
export {
  extractHtmlCode,
  formatRichMarkdown as formatMarkdown
} from '../utils/markdown.js';
export { openHtmlPreviewModal } from './chat/preview.js';
export {
  renderChatSidebar,
  renderActiveChatSession,
  sendGeneralChatMessage,
  initAIChat
} from './chat/ui.js';
