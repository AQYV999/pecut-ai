/**
 * Pecut AI — Workspace Canvas Document Editor Helpers
 * Apache-2.0 License
 */

import { saveWorkspace, getActiveWorkspace } from '../workspaceStorage.js';
import { showToast } from '../../utils/helpers.js';
import { extractCanvasContent } from './format.js';

/**
 * Updates the document save status indicator.
 * @param {string} text
 */
export function updateSaveStatus(text) {
  const statusEl = document.getElementById('canvasSaveStatus');
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.style.opacity = text === 'Saving...' ? '0.6' : '1';
  }
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
