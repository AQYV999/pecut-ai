/**
 * Pecut AI — Shared Markdown & HTML Extraction Utilities
 * Apache-2.0 License
 *
 * Centralizes safe HTML escaping, markdown rendering, collapsible reasoning
 * blocks, and runnable HTML extraction for both Chat and Workspace Canvas.
 */

import { escapeHtml } from './helpers.js';

/**
 * Shared inline formatting for escaped text (inline code, bold, line breaks).
 * @param {string} text
 * @returns {string}
 */
function formatInlineAndBreaks(text) {
  const withInline = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  const withBold = withInline.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return withBold.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
}

/**
 * Basic markdown-to-HTML parser for compact chat bubbles (e.g. Workspace Canvas).
 * Safely escapes HTML and renders fenced code blocks, bold, and inline code.
 * @param {string} text
 * @returns {string}
 */
export function formatSimpleMarkdown(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);

  const withCodeBlocks = escaped.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  return formatInlineAndBreaks(withCodeBlocks);
}

/**
 * Rich markdown-to-HTML formatter with copyable code wrappers and HTML Live Preview triggers.
 * Gracefully auto-closes truncated fenced code blocks.
 * @param {string} text
 * @returns {string}
 */
export function formatRichMarkdown(text) {
  if (!text) return '';

  // Auto-close unclosed fenced code block if response was truncated mid-code
  let normalized = String(text);
  const fenceMatches = normalized.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 === 1) {
    normalized += '\n```';
  }

  const escaped = escapeHtml(normalized);

  // Fenced code blocks with language badge, copy button, and HTML preview if applicable
  const withCode = escaped.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
    const rawCode = code.trim();
    const isHtml = (lang || '').toLowerCase() === 'html'
      || rawCode.startsWith('&lt;!DOCTYPE')
      || rawCode.startsWith('&lt;html');
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

  return formatInlineAndBreaks(withCode);
}

/**
 * Renders a collapsible Thinking / Reasoning details box when reasoning tokens exist.
 * @param {string} reasoning
 * @returns {string}
 */
export function renderThinkingBox(reasoning) {
  if (!reasoning || !reasoning.trim()) return '';
  const trimmed = reasoning.trim();
  const words = trimmed.split(/\s+/).length;
  return `
    <details class="thinking-box">
      <summary>💭 Thinking (${words} kata)</summary>
      <div class="thinking-box-body">${escapeHtml(trimmed).replace(/\n/g, '<br>')}</div>
    </details>
  `;
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
