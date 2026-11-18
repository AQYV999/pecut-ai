import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FLOW_RUNS,
  MAX_RUN_OUTPUT_CHARS,
  RUNS_STORAGE_KEY,
  loadFlowRuns,
  saveFlowRun,
  getFlowRunById,
  deleteFlowRun,
  clearFlowRuns,
  createRunSnapshot,
  getLatestRunForFlow
} from '../src/modules/flow/runStorage.js';

// Setup Mock LocalStorage
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStore.get(k) || null,
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

test('1.4.1: createRunSnapshot creates an immutable, clean copy of workflow configuration', () => {
  const originalFlow = {
    id: 'flow_snap_1',
    title: 'Snapshot Test',
    category: 'Engineering',
    steps: [
      { id: 's1', title: 'Step 1', instruction: 'Do 1', provider: 'gemini', model: 'gemini-3.8-flash' }
    ]
  };

  const snapshot = createRunSnapshot(originalFlow);

  assert.equal(snapshot.id, 'flow_snap_1');
  assert.equal(snapshot.title, 'Snapshot Test');
  assert.equal(snapshot.steps.length, 1);

  // Mutating original flow must NOT mutate the snapshot
  originalFlow.title = 'Mutated Title';
  originalFlow.steps[0].instruction = 'Mutated Instruction';

  assert.equal(snapshot.title, 'Snapshot Test');
  assert.equal(snapshot.steps[0].instruction, 'Do 1');
});

test('1.4.2: saveFlowRun persists run records and enforces the 20-run limit via pruning', () => {
  mockStore.clear();

  // Create 25 runs sequentially
  for (let i = 1; i <= 25; i++) {
    saveFlowRun({
      id: `run_${i}`,
      flowId: 'flow_test',
      flowTitle: 'Test Flow',
      status: 'completed',
      input: `Input ${i}`,
      startedAt: new Date(Date.now() + i * 1000).toISOString(),
      stepResults: [{ stepIndex: 0, title: 'Step 1', output: `Output ${i}` }]
    });
  }

  const allRuns = loadFlowRuns();
  assert.equal(allRuns.length, MAX_FLOW_RUNS, `Runs must be strictly capped at ${MAX_FLOW_RUNS}`);

  // The newest run (run_25) must be at the top, and the oldest runs (run_1 to run_5) must be pruned
  assert.equal(allRuns[0].id, 'run_25');
  assert.ok(!allRuns.some(r => r.id === 'run_1'), 'Oldest run_1 must be pruned');
  assert.ok(!allRuns.some(r => r.id === 'run_5'), 'Oldest run_5 must be pruned');
  assert.ok(allRuns.some(r => r.id === 'run_6'), 'run_6 should be preserved');
});

test('1.4.3: saveFlowRun enforces MAX_RUN_OUTPUT_CHARS per step to protect localStorage quota', () => {
  mockStore.clear();

  const massiveOutput = 'A'.repeat(MAX_RUN_OUTPUT_CHARS + 5000);
  const run = saveFlowRun({
    id: 'run_massive',
    flowId: 'flow_large',
    flowTitle: 'Large Output Test',
    status: 'completed',
    input: 'Big task',
    stepResults: [
      { stepIndex: 0, title: 'Step 1', output: massiveOutput }
    ]
  });

  const saved = getFlowRunById('run_massive');
  assert.ok(saved);
  assert.ok(saved.stepResults[0].output.length <= MAX_RUN_OUTPUT_CHARS + 100);
  assert.ok(saved.stepResults[0].output.includes('[Output truncated for storage budget]'));
});

test('1.4.4: getLatestRunForFlow retrieves the most recent run for a specific workflow', () => {
  mockStore.clear();

  const flowA = 'flow_alpha';
  const flowB = 'flow_beta';

  saveFlowRun({
    id: 'run_a1',
    flowId: flowA,
    startedAt: '2026-11-18T10:00:00.000Z',
    status: 'completed'
  });

  saveFlowRun({
    id: 'run_b1',
    flowId: flowB,
    startedAt: '2026-11-18T10:05:00.000Z',
    status: 'completed'
  });

  saveFlowRun({
    id: 'run_a2',
    flowId: flowA,
    startedAt: '2026-11-18T10:10:00.000Z',
    status: 'failed',
    error: { message: 'HTTP 429' }
  });

  const latestA = getLatestRunForFlow(flowA);
  assert.ok(latestA);
  assert.equal(latestA.id, 'run_a2');
  assert.equal(latestA.status, 'failed');

  const latestB = getLatestRunForFlow(flowB);
  assert.ok(latestB);
  assert.equal(latestB.id, 'run_b1');
});

test('1.4.5: deleteFlowRun and clearFlowRuns clean up storage properly', () => {
  mockStore.clear();

  saveFlowRun({ id: 'r1', flowId: 'f1', startedAt: new Date().toISOString() });
  saveFlowRun({ id: 'r2', flowId: 'f1', startedAt: new Date().toISOString() });

  assert.equal(loadFlowRuns().length, 2);

  deleteFlowRun('r1');
  const remaining = loadFlowRuns();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 'r2');

  clearFlowRuns();
  assert.equal(loadFlowRuns().length, 0);
});
