import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countCodeFences,
  isInsideCodeBlock,
  findBoundaryOverlap,
  stitchContent,
  buildAnchoredContinuationPrompt,
  canAutoContinue
} from '../src/utils/continuation.js';

test('countCodeFences and isInsideCodeBlock detect unclosed code fences', () => {
  const complete = '```html\n<h1>Hi</h1>\n```';
  assert.equal(countCodeFences(complete), 2);
  assert.equal(isInsideCodeBlock(complete), false);

  const truncated = '```html\n<h1>Hi</h1>\n<p>Cut off here...';
  assert.equal(countCodeFences(truncated), 1);
  assert.equal(isInsideCodeBlock(truncated), true);
});

test('findBoundaryOverlap finds overlapping characters between boundary edges', () => {
  const prev = 'background: #fafafa; flex-direction: column; a';
  const next = 'align-items: center; }';
  // Overlap is "a"
  assert.equal(findBoundaryOverlap(prev, next), 1);

  const prev2 = 'const myFunction = testVal';
  const next2 = 'Val + 10;';
  // Overlap is "Val"
  assert.equal(findBoundaryOverlap(prev2, next2), 3);

  const prev3 = 'No overlap here.';
  const next3 = 'Brand new sentence.';
  assert.equal(findBoundaryOverlap(prev3, next3), 0);
});

test('stitchContent seamlessly merges code cut off mid-word', () => {
  const prev = '```css\n.nav-links { flex-direction: column; a';
  const next = 'lign-items: center; }\n```';
  const merged = stitchContent(prev, next);
  assert.equal(merged, '```css\n.nav-links { flex-direction: column; align-items: center; }\n```');
  assert.equal(countCodeFences(merged), 2);
});

test('stitchContent deduplicates overlapping characters at boundary', () => {
  const prev = '```css\n.nav-links { flex-direction: column; a';
  const next = 'align-items: center; }\n```';
  const merged = stitchContent(prev, next);
  assert.equal(merged, '```css\n.nav-links { flex-direction: column; align-items: center; }\n```');
});

test('stitchContent strips redundant opening code fence from continuation', () => {
  const prev = '```html\n<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { margin: 0; }\n';
  const next = '```html\n  </style>\n</head>\n<body>\n  <h1>Done</h1>\n</body>\n</html>\n```';
  const merged = stitchContent(prev, next);

  assert.equal(countCodeFences(merged), 2, 'Must have exactly one pair of opening and closing fences');
  assert.ok(merged.startsWith('```html\n<!DOCTYPE html>'));
  assert.ok(merged.endsWith('</html>\n```'));
  assert.ok(!merged.includes('```html\n  </style>'));
});

test('stitchContent strips conversational filler before code continuation', () => {
  const prev = '```html\n<!DOCTYPE html>\n<html>\n';
  const next = 'Tentu, berikut kelanjutan kodenya:\n\n```html\n<body>\n  <main>Portfolio</main>\n</body>\n</html>\n```';
  const merged = stitchContent(prev, next);

  assert.ok(!merged.includes('Tentu, berikut'));
  assert.ok(merged.includes('<body>\n  <main>Portfolio</main>'));
  assert.equal(countCodeFences(merged), 2);
});

test('buildAnchoredContinuationPrompt quotes tail snippet for model orientation', () => {
  const code = '```html\n' + 'x'.repeat(500) + '\n<div class="footer">Copyright 2026';
  const prompt = buildAnchoredContinuationPrompt(code, false);
  assert.ok(prompt.includes('Titik terakhir sebelum terpotong:'));
  assert.ok(prompt.includes('<div class="footer">Copyright 2026'));
  assert.ok(prompt.includes('Lanjutkan langsung'));

  const reasoningPrompt = buildAnchoredContinuationPrompt(code, true);
  assert.ok(reasoningPrompt.includes('<!DOCTYPE html> sampai </html>'));
  assert.ok(reasoningPrompt.includes('DILARANG berpikir'));
});

test('canAutoContinue enforces limit and minimum content criteria', () => {
  const validMsg = { truncated: true, isReasoningOnly: false, content: '```html\n<!DOCTYPE html>'.padEnd(200, ' ') };
  assert.equal(canAutoContinue(validMsg, 1, 3), true);
  assert.equal(canAutoContinue(validMsg, 2, 3), true);
  assert.equal(canAutoContinue(validMsg, 3, 3), false, 'Must stop when max parts reached');

  const reasoningOnlyMsg = { truncated: true, isReasoningOnly: true, content: 'Too short' };
  assert.equal(canAutoContinue(reasoningOnlyMsg, 1, 3), false);

  const completeMsg = { truncated: false, isReasoningOnly: false, content: 'Valid code' };
  assert.equal(canAutoContinue(completeMsg, 1, 3), false);
});
