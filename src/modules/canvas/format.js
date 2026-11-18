/**
 * Pecut AI — Workspace Canvas Pure Formatting & Extraction Helpers
 * Apache-2.0 License
 */

import { formatSimpleMarkdown } from '../../utils/markdown.js';

/**
 * Basic markdown-to-HTML parser for chat bubbles.
 * Safely renders code blocks, bold, lists, and inline code.
 * @param {string} text
 * @returns {string}
 */
export function formatChatMessage(text) {
  return formatSimpleMarkdown(text);
}

/**
 * Extracts prompt/content text from an AI response for Canvas application.
 * If code blocks exist, extracts the largest code block. Otherwise returns full text.
 * @param {string} rawText
 * @returns {string}
 */
export function extractCanvasContent(rawText) {
  if (!rawText) return '';
  const codeBlockRegex = /```(?:markdown|prompt|text)?\n([\s\S]*?)```/gi;
  const matches = [...rawText.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    // Find the longest code block
    matches.sort((a, b) => b[1].length - a[1].length);
    return matches[0][1].trim();
  }
  return rawText.trim();
}
