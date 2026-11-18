/**
 * Pecut AI — Live HTML Sandbox Preview Modal
 * Apache-2.0 License
 */

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
