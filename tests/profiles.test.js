import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILES } from '../src/data/profiles.js';

test('DEFAULT_PROFILES has at least 3 curated context profiles', () => {
  assert.ok(DEFAULT_PROFILES.length >= 3);
});

test('Every profile has valid schema (id, name, category, role, tone, context, constraints)', () => {
  const ids = new Set();
  for (const p of DEFAULT_PROFILES) {
    assert.ok(p.id, 'Profile must have an id');
    assert.ok(!ids.has(p.id), `Duplicate profile id: ${p.id}`);
    ids.add(p.id);

    assert.ok(p.name && p.name.trim().length > 0, `Profile ${p.id} must have a name`);
    assert.ok(p.category && p.category.trim().length > 0, `Profile ${p.id} must have a category`);
    assert.ok(p.role && p.role.trim().length > 0, `Profile ${p.id} must have a role`);
    assert.ok(p.tone && p.tone.trim().length > 0, `Profile ${p.id} must have a tone`);
    assert.ok(p.context && p.context.trim().length > 0, `Profile ${p.id} must have context`);
    assert.ok(p.constraints && p.constraints.trim().length > 0, `Profile ${p.id} must have constraints`);
  }
});
