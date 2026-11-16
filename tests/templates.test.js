import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES_DATA } from '../src/data/templates.js';

test('TEMPLATES_DATA should have exactly 22 curated templates', () => {
  assert.equal(TEMPLATES_DATA.length, 22);
});

test('Every template must have valid id, title, category, description, and content', () => {
  const ids = new Set();
  const validCategories = new Set([
    'Programming',
    'Business',
    'Writing',
    'Education',
    'Marketing',
    'Research',
    'Creative',
    'Productivity'
  ]);

  for (const t of TEMPLATES_DATA) {
    assert.ok(t.id, 'Template must have an id');
    assert.ok(!ids.has(t.id), `Duplicate template id detected: ${t.id}`);
    ids.add(t.id);

    assert.ok(t.title && t.title.trim().length > 0, `Template ${t.id} must have a non-empty title`);
    assert.ok(validCategories.has(t.category), `Template ${t.id} has invalid category: ${t.category}`);
    assert.ok(t.description && t.description.trim().length > 0, `Template ${t.id} must have a description`);
    assert.ok(t.content && t.content.trim().length > 0, `Template ${t.id} must have content`);
  }
});
