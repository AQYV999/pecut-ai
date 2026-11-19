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
/**
 * Shared inline formatting for escaped text (inline code, bold, italic, safe links).
 * @param {string} text
 * @returns {string}
 */
function formatInline(text) {
  let res = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/(^|[^*_])(\*|_)([^*_]+)\2/g, '$1<em>$3</em>');
  // Safe Markdown images: strictly reject javascript:, data:, and vbscript: URIs
  res = res.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const trimmed = url.trim();
    const isSafe = /^https?:\/\/|^\/|^\.\//i.test(trimmed) && !/^(?:javascript|data|vbscript):/i.test(trimmed);
    const safeSrc = isSafe ? trimmed : '';
    return safeSrc ? `<img src="${safeSrc}" alt="${alt}" loading="lazy">` : '';
  });
  // Safe Markdown links: strictly reject javascript:, data:, and non-web URIs
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const trimmed = url.trim();
    const isSafe = /^https?:\/\/|^\/|^#/i.test(trimmed) && !/^(?:javascript|data|vbscript):/i.test(trimmed);
    const safeHref = isSafe ? trimmed : '#';
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return res;
}

/**
 * Formats Markdown tables from escaped text.
 * @param {string} text
 * @returns {string}
 */
function formatTables(text) {
  const tableRegex = /((?:^|\n)\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g;
  return text.replace(tableRegex, (match) => {
    const lines = match.trim().split(/\r?\n/).map(l => l.trim());
    if (lines.length < 3) return match;
    const headerRow = lines[0];
    const dataRows = lines.slice(2);

    const parseCells = (row) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const headers = parseCells(headerRow);
    const thead = `<thead><tr>${headers.map(h => `<th>${formatInline(h)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${dataRows.map(r => `<tr>${parseCells(r).map(c => `<td>${formatInline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `\n<table class="flow-markdown-table">${thead}${tbody}</table>\n`;
  });
}

/**
 * Formats Markdown block elements (headings, blockquotes, lists).
 * @param {string} text
 * @returns {string}
 */
function formatBlockElements(text) {
  // Headings
  let res = text
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Blockquotes
  res = res.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Tables
  res = formatTables(res);

  // Unordered lists
  res = res.replace(/((?:^(?:[-*]|\&bull;)\s+[^\n]+\r?\n?)+)/gm, (match) => {
    const items = match.trim().split(/\r?\n/).map(line => {
      const clean = line.replace(/^(?:[-*]|\&bull;)\s+/, '');
      return `<li>${formatInline(clean)}</li>`;
    });
    return `<ul>${items.join('')}</ul>`;
  });

  // Ordered lists
  res = res.replace(/((?:^\d+\.\s+[^\n]+\r?\n?)+)/gm, (match) => {
    const items = match.trim().split(/\r?\n/).map(line => {
      const clean = line.replace(/^\d+\.\s+/, '');
      return `<li>${formatInline(clean)}</li>`;
    });
    return `<ol>${items.join('')}</ol>`;
  });

  // Inline formatting
  res = formatInline(res);

  // Line breaks outside tags
  return res.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
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

  return formatBlockElements(withCodeBlocks);
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

  // Stash fenced code blocks in placeholders so markdown rules don't mutate code contents
  const codeBlocks = [];
  const withCodePlaceholders = escaped.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
    const rawCode = code.trim();
    const isHtml = (lang || '').toLowerCase() === 'html'
      || rawCode.startsWith('&lt;!DOCTYPE')
      || rawCode.startsWith('&lt;html');
    const index = codeBlocks.length;
    codeBlocks.push(`
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
    `);
    return `%%%PECUTCODEBLOCK${index}%%%`;
  });

  // Apply rich markdown parsing (headings, blockquotes, tables, lists, bold, italics, links)
  let formatted = formatBlockElements(withCodePlaceholders);

  // Restore code blocks
  formatted = formatted.replace(/%%%PECUTCODEBLOCK(\d+)%%%/g, (_, idx) => {
    return codeBlocks[parseInt(idx, 10)] || '';
  });

  return formatted;
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
