/**
 * Pecut AI — Workspace Canvas & Interactive Chat Controller (Facade)
 * Apache-2.0 License
 *
 * Re-exports modular canvas components for full backward compatibility
 * with app imports and unit tests.
 */

export {
  formatChatMessage,
  extractCanvasContent
} from './canvas/format.js';

export { applyContentToDocument } from './canvas/editor.js';

export {
  renderChatStream,
  sendChatMessage
} from './canvas/chat.js';

export {
  renderWorkspaceList,
  renderProfileSelector,
  renderCurrentWorkspace,
  initCanvas
} from './canvas/ui.js';
