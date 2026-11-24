/**
 * Pecut AI — Seamless Response Stitching & Multi-Part Continuation
 * Apache-2.0 License
 *
 * Merges split/truncated model generations into a single complete, unbroken document.
 * Eliminates disjointed chat bubbles and broken code blocks so users always receive
 * 100% complete, runnable, and previewable deliverables.
 */

/**
 * Common conversational greetings/fillers emitted by models before continuing.
 */
const CONTINUATION_FILLER_REGEX = /^(?:(?:Tentu|Baik|Berikut|Berikut ini|Kelanjutan|Lanjutan|Melanjutkan|Sure|Here is|Here's the continuation|Continuing|Sure thing|Understood)[^:\n]*:?\s*)+/i;

/**
 * Counts the number of code fence markers (```) in a string.
 * @param {string} text
 * @returns {number}
 */
export function countCodeFences(text) {
  if (!text || typeof text !== 'string') return 0;
  const matches = text.match(/```/g);
  return matches ? matches.length : 0;
}

/**
 * Detects if a text ends inside an unclosed code block.
 * @param {string} text
 * @returns {boolean}
 */
export function isInsideCodeBlock(text) {
  return countCodeFences(text) % 2 === 1;
}

/**
 * Finds the length of overlapping characters between the end of prevText and start of nextText.
 * E.g. prevText ends with "align-" and nextText starts with "align-items: center;" -> overlap 6 ("align-").
 * @param {string} prevText
 * @param {string} nextText
 * @param {number} [maxOverlap=80]
 * @returns {number}
 */
export function findBoundaryOverlap(prevText, nextText, maxOverlap = 80) {
  if (!prevText || !nextText) return 0;
  const max = Math.min(prevText.length, nextText.length, maxOverlap);
  for (let len = max; len >= 1; len--) {
    if (prevText.endsWith(nextText.slice(0, len))) {
      return len;
    }
  }
  return 0;
}

/**
 * Stitches a continuation chunk cleanly onto previously truncated content.
 * Handles mid-sentence breaks, unclosed code fences, conversational prefixes, and overlapping characters.
 * @param {string} prevContent
 * @param {string} continuationContent
 * @returns {string}
 */
export function stitchContent(prevContent, continuationContent) {
  const prev = typeof prevContent === 'string' ? prevContent : '';
  let next = typeof continuationContent === 'string' ? continuationContent : '';

  if (!prev.trim()) return next.trim();
  if (!next.trim()) return prev;

  const inCode = isInsideCodeBlock(prev);

  // 1. If previous text ended inside an unclosed code block, strip conversational intro fillers
  if (inCode) {
    next = next.replace(CONTINUATION_FILLER_REGEX, '').trimStart();

    // 2. If continuation starts with a redundant code fence (e.g. ```html\n or ```css\n), strip it
    const openingFenceMatch = next.match(/^```[a-zA-Z0-9_-]*\r?\n/);
    if (openingFenceMatch) {
      next = next.slice(openingFenceMatch[0].length);
    }
  }

  // 3. Detect and remove character overlap at the boundary
  const overlap = findBoundaryOverlap(prev, next, 80);
  if (overlap > 0) {
    next = next.slice(overlap);
  }

  // 4. Concatenate
  const combined = prev + next;

  return combined;
}

/**
 * Builds an anchored continuation prompt containing the tail of the truncated output.
 * Gives the AI an exact starting point so it never starts over or says "belum ada konten".
 * @param {string} truncatedContent
 * @param {boolean} [isReasoningOnly=false]
 * @returns {string}
 */
export function buildAnchoredContinuationPrompt(truncatedContent, isReasoningOnly = false) {
  if (isReasoningOnly) {
    return 'Tuliskan dan cetak langsung kode HTML lengkapnya sekarang dari <!DOCTYPE html> sampai </html>. DILARANG berpikir atau menggunakan tag <think>. Langsung keluarkan kodenya.';
  }

  const raw = String(truncatedContent || '').trim();
  const tail = raw.length > 250 ? raw.slice(-250) : raw;

  return `Lanjutkan kode program / tulisan berikut persis dari titik terakhir yang terpotong tanpa mengulang dari awal, tanpa kata pengantar, dan tanpa mengulang berpikir.
Titik terakhir sebelum terpotong:
"""
...${tail}
"""
Lanjutkan langsung dari karakter setelah potongan di atas sampai tuntas selesai:`;
}

/**
 * Checks whether an assistant message qualifies for automatic continuation.
 * @param {Object} msg
 * @param {number} [currentParts=1]
 * @param {number} [maxParts=3]
 * @returns {boolean}
 */
export function canAutoContinue(msg, currentParts = 1, maxParts = 3) {
  if (!msg || !msg.truncated) return false;
  if (msg.isReasoningOnly) return false;
  if (currentParts >= maxParts) return false;
  const content = (msg.content || '').trim();
  if (content.length < 20) return false;
  return true;
}
