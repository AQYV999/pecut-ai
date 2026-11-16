import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FLOWS } from '../src/data/flows.js';

test('DEFAULT_FLOWS contains at least 3 curated multi-step workflows', () => {
  assert.ok(DEFAULT_FLOWS.length >= 3);
});

test('Every flow has valid structure with sequential steps', () => {
  const ids = new Set();
  for (const flow of DEFAULT_FLOWS) {
    assert.ok(flow.id, 'Flow must have an id');
    assert.ok(!ids.has(flow.id), `Duplicate flow id: ${flow.id}`);
    ids.add(flow.id);

    assert.ok(flow.title && flow.title.trim().length > 0, `Flow ${flow.id} must have a title`);
    assert.ok(flow.category && flow.category.trim().length > 0, `Flow ${flow.id} must have a category`);
    assert.ok(flow.description && flow.description.trim().length > 0, `Flow ${flow.id} must have a description`);
    assert.ok(Array.isArray(flow.steps) && flow.steps.length >= 2, `Flow ${flow.id} must have at least 2 steps`);

    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      assert.ok(step.title && step.title.trim().length > 0, `Flow ${flow.id} step ${i} must have a title`);
      assert.ok(step.instruction && step.instruction.trim().length > 0, `Flow ${flow.id} step ${i} must have an instruction`);
    }
  }
});
