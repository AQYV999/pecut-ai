import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatChatMessage, extractCanvasContent } from '../src/modules/canvas.js';

test('formatChatMessage safely escapes HTML and renders code blocks', () => {
  const raw = 'Hello <script>alert(1)</script>\n```markdown\n# Header\n```';
  const formatted = formatChatMessage(raw);
  assert.equal(formatted.includes('<script>'), false);
  assert.equal(formatted.includes('&lt;script&gt;'), true);
  assert.equal(formatted.includes('<pre><code class="language-markdown"># Header</code></pre>'), true);
});

test('formatChatMessage converts bold and inline code', () => {
  const raw = 'This is **important** and `variable_name`';
  const formatted = formatChatMessage(raw);
  assert.equal(formatted.includes('<strong>important</strong>'), true);
  assert.equal(formatted.includes('<code>variable_name</code>'), true);
});

test('extractCanvasContent pulls out largest code block if present', () => {
  const aiOutput = 'Here is your prompt:\n```markdown\n# Master Prompt\nRole: Senior Architect\n```\nHope this helps!';
  const extracted = extractCanvasContent(aiOutput);
  assert.equal(extracted, '# Master Prompt\nRole: Senior Architect');
});

test('extractCanvasContent falls back to full trimmed text if no code blocks', () => {
  const plainText = 'Direct prompt without backticks.';
  const extracted = extractCanvasContent(plainText);
  assert.equal(extracted, 'Direct prompt without backticks.');
});
