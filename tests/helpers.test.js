import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/utils/helpers.js';

test('escapeHtml should escape HTML entities properly', () => {
  const dangerous = '<script>alert("XSS" & \'injection\')</script>';
  const safe = escapeHtml(dangerous);
  assert.equal(safe, '&lt;script&gt;alert(&quot;XSS&quot; &amp; &#039;injection&#039;)&lt;/script&gt;');
});

test('escapeHtml should handle empty or non-string inputs safely', () => {
  assert.equal(escapeHtml(''), '');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(123), '');
});
