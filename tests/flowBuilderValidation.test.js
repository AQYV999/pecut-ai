import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStepReferences,
  computeInvalidatedSteps
} from '../src/modules/flow/validation.js';
import {
  saveFlowRun,
  loadFlowRuns,
  MAX_TOTAL_RUN_OUTPUT_CHARS,
  MAX_RUNS_STORAGE_BYTES,
  MAX_FLOW_RUNS
} from '../src/modules/flow/runStorage.js';

// Setup Mock LocalStorage
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStore.get(k) || null,
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

test('2.1.1: validateStepReferences detects {{prev}} error on first step', () => {
  const steps = [
    { id: 's1', title: 'Step 1', instruction: 'Start with {{prev}}' },
    { id: 's2', title: 'Step 2', instruction: 'Next with {{prev}}' }
  ];

  const result = validateStepReferences(steps);
  assert.equal(result.isValid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].type, 'invalid_prev');
  assert.equal(result.errors[0].stepIndex, 0);

  // Case-insensitive & alias check: {{PREV}} and {{previous}} on step 1 must also fail
  const upperResult = validateStepReferences([
    { id: 's1', title: 'Step 1', instruction: 'Start with {{PREV}}' }
  ]);
  assert.equal(upperResult.isValid, false);
  assert.equal(upperResult.errors[0].type, 'invalid_prev');

  const aliasResult = validateStepReferences([
    { id: 's1', title: 'Step 1', instruction: 'Start with {{previous}}' }
  ]);
  assert.equal(aliasResult.isValid, false);
  assert.equal(aliasResult.errors[0].type, 'invalid_prev');
});

test('2.1.2: validateStepReferences detects forward reference and self-reference on {{stepN}}', () => {
  const steps = [
    { id: 's1', title: 'Step 1', instruction: 'Need {{step2}} and {{step1}}' },
    { id: 's2', title: 'Step 2', instruction: 'Need {{step2}} self' },
    { id: 's3', title: 'Step 3', instruction: 'Valid {{step1}} and {{step2}}' }
  ];

  const result = validateStepReferences(steps);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.type === 'forward_reference' && e.stepIndex === 0));
  assert.ok(result.errors.some(e => e.type === 'self_reference' && e.stepIndex === 0));
  assert.ok(result.errors.some(e => e.type === 'self_reference' && e.stepIndex === 1));

  // Step 3 has valid backward references only
  assert.ok(!result.errors.some(e => e.stepIndex === 2));
});

test('2.1.3: validateStepReferences validates stable ID references {{step:id}}', () => {
  const steps = [
    { id: 'step_init', title: 'Step 1', instruction: 'Start {{input}}' },
    { id: 'step_mid', title: 'Step 2', instruction: 'Analyze {{step:step_init}}' },
    { id: 'step_final', title: 'Step 3', instruction: 'Combine {{step:step_mid}} and {{step:non_existent}}' }
  ];

  const result = validateStepReferences(steps);
  assert.equal(result.isValid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].type, 'missing_step');
  assert.equal(result.errors[0].stepIndex, 2);
});

test('2.1.4: computeInvalidatedSteps marks downstream steps when an upstream step is modified or reordered', () => {
  const oldSteps = [
    { id: 's1', title: 'Architecture', instruction: 'Analyze {{input}}' },
    { id: 's2', title: 'Implementation', instruction: 'Code based on {{prev}}' },
    { id: 's3', title: 'Tests', instruction: 'Write tests for {{step:s2}} and {{step1}}' }
  ];

  // Modify step 1 instruction
  const newStepsModified = [
    { id: 's1', title: 'Architecture V2', instruction: 'Analyze architecture thoroughly: {{input}}' },
    { id: 's2', title: 'Implementation', instruction: 'Code based on {{prev}}' },
    { id: 's3', title: 'Tests', instruction: 'Write tests for {{step:s2}} and {{step1}}' }
  ];

  const inv1 = computeInvalidatedSteps({ oldSteps, newSteps: newStepsModified });
  assert.equal(inv1.hasInvalidations, true);
  // s1 was modified directly
  assert.ok(inv1.invalidatedStepIds.includes('s1'));
  // s2 depends on s1 via {{prev}}
  assert.ok(inv1.invalidatedStepIds.includes('s2'));
  // s3 depends on s2 and s1
  assert.ok(inv1.invalidatedStepIds.includes('s3'));

  // Test reordering: swap s2 and s3
  const newStepsReordered = [
    oldSteps[0],
    oldSteps[2],
    oldSteps[1]
  ];

  const inv2 = computeInvalidatedSteps({ oldSteps, newSteps: newStepsReordered });
  assert.equal(inv2.hasInvalidations, true);
  assert.ok(inv2.invalidatedStepIds.includes('s2'));
  assert.ok(inv2.invalidatedStepIds.includes('s3'));

  // Test downstream invalidation via {{PREV}} and {{previous}}
  const oldStepsUpper = [
    { id: 's1', title: 'Step 1', instruction: 'Do 1' },
    { id: 's2', title: 'Step 2', instruction: 'Do 2 with {{PREV}}' }
  ];
  const newStepsUpper = [
    { id: 's1', title: 'Step 1 Modified', instruction: 'Do 1 Modified' },
    { id: 's2', title: 'Step 2', instruction: 'Do 2 with {{PREV}}' }
  ];
  const invUpper = computeInvalidatedSteps({ oldSteps: oldStepsUpper, newSteps: newStepsUpper });
  assert.equal(invUpper.hasInvalidations, true);
  assert.ok(invUpper.invalidatedStepIds.includes('s2'), 'Downstream step referencing {{PREV}} must be invalidated');
});

test('2.1.5: saveFlowRun enforces MAX_TOTAL_RUN_OUTPUT_CHARS across all steps', () => {
  mockStore.clear();

  // Create 5 steps each producing 25,000 chars -> Total = 125,000 chars (> 100,000 budget)
  const stepResults = [
    { stepIndex: 0, title: 'Step 1', output: 'A'.repeat(25000) },
    { stepIndex: 1, title: 'Step 2', output: 'B'.repeat(25000) },
    { stepIndex: 2, title: 'Step 3', output: 'C'.repeat(25000) },
    { stepIndex: 3, title: 'Step 4', output: 'D'.repeat(25000) },
    { stepIndex: 4, title: 'Step 5', output: 'E'.repeat(25000) }
  ];

  const run = saveFlowRun({
    id: 'run_total_test',
    flowId: 'flow_budget',
    status: 'completed',
    stepResults
  });

  const totalChars = run.stepResults.reduce((acc, s) => acc + s.output.length, 0);
  assert.ok(totalChars <= MAX_TOTAL_RUN_OUTPUT_CHARS + 200, `Total run chars (${totalChars}) must not exceed budget ${MAX_TOTAL_RUN_OUTPUT_CHARS}`);
  assert.ok(run.stepResults[4].output.includes('Truncated for total run budget') || run.stepResults[4].output.includes('omitted for total run storage budget'));
});

test('2.1.6: persistRunsInternal enforces MAX_RUNS_STORAGE_BYTES cap by pruning older runs', () => {
  mockStore.clear();

  // Create runs with large outputs so the storage byte size exceeds MAX_RUNS_STORAGE_BYTES (1MB)
  for (let i = 1; i <= 20; i++) {
    saveFlowRun({
      id: `run_big_${i}`,
      flowId: 'flow_big',
      startedAt: new Date(Date.now() + i * 1000).toISOString(),
      stepResults: [
        { stepIndex: 0, title: 'Step 1', output: 'X'.repeat(25000) },
        { stepIndex: 1, title: 'Step 2', output: 'Y'.repeat(25000) },
        { stepIndex: 2, title: 'Step 3', output: 'Z'.repeat(25000) }
      ]
    });
  }

  const rawStorage = mockStore.get('pecut_flow_runs');
  assert.ok(rawStorage, 'Storage must have records');
  assert.ok(rawStorage.length <= MAX_RUNS_STORAGE_BYTES, `Storage string length (${rawStorage.length}) must be <= ${MAX_RUNS_STORAGE_BYTES}`);
});
