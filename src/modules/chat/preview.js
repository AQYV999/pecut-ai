/**
 * Pecut AI — Live HTML Sandbox Preview Modal
 * Apache-2.0 License
 *
 * Strict Security: Renders untrusted AI-generated code exclusively inside a sandboxed
 * iframe with opaque/null origin (`sandbox="allow-scripts allow-modals"`).
 * Never executes raw HTML directly in the application's top-level origin.
 */

let activePreviewHtml = '';

/**
 * Opens a modal with a sandboxed iframe to live preview generated HTML.
 * @param {string} htmlCode
 */
export function openHtmlPreviewModal(htmlCode) {
  activePreviewHtml = htmlCode || '';
  let modal = document.getElementById('chatHtmlPreviewModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'chatHtmlPreviewModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box chat-preview-modal-box" id="chatPreviewModalBox" style="max-width: 95vw; width: 1200px; height: 90vh; display: flex; flex-direction: column; padding: 0; transition: all 0.2s ease;">
        <div class="modal-header" style="padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--surface-border); display: flex; justify-content: space-between; align-items: center; background: var(--surface-card);">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">🌐 Live HTML Web Preview</span>
            <span class="badge-pro" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">Isolated Sandbox</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary btn-xs" id="chatPreviewDownloadBtn" title="Unduh file HTML ke komputer Anda">⬇ Unduh .html</button>
            <button type="button" class="btn btn-secondary btn-xs" id="chatPreviewFullscreenBtn" title="Toggle Layar Penuh">⛶ Layar Penuh</button>
            <button type="button" class="btn btn-ghost btn-sm" id="chatPreviewCloseBtn" title="Tutup">✕</button>
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

    // Secure Download: saves standalone .html file locally without executing in parent origin
    document.getElementById('chatPreviewDownloadBtn')?.addEventListener('click', () => {
      if (!activePreviewHtml) return;
      const blob = new Blob([activePreviewHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preview_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    // Toggle Fullscreen modal view while strictly preserving iframe sandbox isolation
    document.getElementById('chatPreviewFullscreenBtn')?.addEventListener('click', () => {
      const box = document.getElementById('chatPreviewModalBox');
      if (!box) return;
      const isFullscreen = box.style.width === '100vw' && box.style.height === '100vh';
      if (isFullscreen) {
        box.style.width = '1200px';
        box.style.height = '90vh';
        box.style.maxWidth = '95vw';
        box.style.borderRadius = '';
      } else {
        box.style.width = '100vw';
        box.style.height = '100vh';
        box.style.maxWidth = '100vw';
        box.style.borderRadius = '0';
      }
    });
  }

  const frame = document.getElementById('chatHtmlPreviewFrame');
  if (frame) {
    frame.srcdoc = activePreviewHtml;
  }
  modal.classList.add('active');
}

if (typeof window !== 'undefined') {
  window.openHtmlPreviewModal = openHtmlPreviewModal;
}
