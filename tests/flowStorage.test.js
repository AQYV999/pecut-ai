import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOW_SCHEMA_VERSION,
  generateFlowId,
  generateStepId,
  normalizeFlowV2,
  validateFlowV2,
  migrateLegacyFlowToV2
} from '../src/modules/flow/schema.js';
import {
  FLOWS_STORAGE_KEY,
  loadFlows,
  saveFlow,
  createFlow,
  deleteFlow,
  duplicateFlow,
  resetBuiltInFlows,
  exportFlowsJSON,
  importFlowsJSON
} from '../src/modules/flow/storage.js';

// Setup Mock LocalStorage
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStore.get(k) || null,
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

test('1.1.1: Schema ID generators create stable, prefixed IDs', () => {
  const flowId1 = generateFlowId();
  const flowId2 = generateFlowId();
  assert.ok(flowId1.startsWith('flow_'), 'Flow ID must start with flow_');
  assert.notEqual(flowId1, flowId2, 'Generated Flow IDs must be unique');

  const stepId1 = generateStepId(0);
  const stepId2 = generateStepId(1);
  assert.ok(stepId1.startsWith('step_1_'), 'Step ID must encode 1-based index prefix');
  assert.ok(stepId2.startsWith('step_2_'));
  assert.notEqual(stepId1, stepId2);
});

test('1.1.2: migrateLegacyFlowToV2 upgrades legacy v1 DEFAULT_FLOWS to valid v2 schema', () => {
  const legacyFlow = {
    id: 'flow-content',
    title: 'Content Creation Pipeline',
    category: 'Marketing',
    description: 'Transform seed topic into posts',
    steps: [
      { title: 'Hook Idea', instruction: 'Generate 3 hooks for {{input}}' },
      { title: 'Draft Post', instruction: 'Write post based on {{prev}}' }
    ]
  };

  const migrated = migrateLegacyFlowToV2(legacyFlow);

  assert.equal(migrated.schemaVersion, FLOW_SCHEMA_VERSION);
  assert.equal(migrated.id, 'flow-content');
  assert.equal(migrated.isBuiltIn, true);
  assert.equal(migrated.steps.length, 2);

  // Each step must now have a stable ID and default execution attributes
  assert.ok(migrated.steps[0].id.startsWith('step_1_'));
  assert.equal(migrated.steps[0].provider, 'inherit');
  assert.equal(migrated.steps[0].model, 'inherit');
  assert.equal(migrated.steps[0].temperature, 0.3);
  assert.equal(migrated.steps[0].maxTokens, 4096);
  assert.equal(migrated.steps[0].contextProfileId, 'inherit');

  assert.ok(migrated.steps[1].id.startsWith('step_2_'));
});

test('1.1.3: validateFlowV2 enforces schema invariants and catches malformed flows', () => {
  // Valid flow
  const valid = {
    schemaVersion: FLOW_SCHEMA_VERSION,
    id: 'flow_test_1',
    title: 'Valid Pipeline',
    category: 'Engineering',
    description: 'A valid test flow',
    steps: [
      { id: 'step_1_abc', title: 'Step 1', instruction: 'Analyze {{input}}' }
    ]
  };
  const valResult = validateFlowV2(valid);
  assert.equal(valResult.valid, true);
  assert.equal(valResult.errors.length, 0);

  // Invalid: missing steps
  const noSteps = { ...valid, steps: [] };
  assert.equal(validateFlowV2(noSteps).valid, false);

  // Invalid: step without instruction
  const brokenStep = {
    ...valid,
    steps: [{ id: 'step_1_abc', title: 'Step 1', instruction: '' }]
  };
  assert.equal(validateFlowV2(brokenStep).valid, false);

  // Invalid: step with dangerous script injection in ID
  const scriptId = {
    ...valid,
    steps: [{ id: '<script>alert(1)</script>', title: 'Step 1', instruction: 'Do work' }]
  };
  assert.equal(validateFlowV2(scriptId).valid, false);
});

test('1.1.4: loadFlows auto-seeds and migrates default flows when storage is empty', () => {
  mockStore.clear();

  const flows = loadFlows();
  assert.ok(Array.isArray(flows));
  assert.ok(flows.length >= 3, 'Must seed at least 3 default workflows');

  for (const flow of flows) {
    assert.equal(flow.schemaVersion, FLOW_SCHEMA_VERSION);
    assert.equal(flow.isBuiltIn, true);
    assert.ok(flow.steps.length >= 2);
    for (const step of flow.steps) {
      assert.ok(step.id);
      assert.ok(step.title);
      assert.ok(step.instruction);
    }
  }

  // Verify persistence into storage
  assert.ok(mockStore.has(FLOWS_STORAGE_KEY));
});

test('1.1.5: Flow CRUD operations work cleanly and preserve stability', () => {
  mockStore.clear();
  loadFlows(); // initial seed

  // 1. Create Flow
  const newFlow = createFlow({
    title: 'Custom Architect Flow',
    category: 'Architecture',
    description: 'Full stack architecture breakdown'
  });
  assert.ok(newFlow.id.startsWith('flow_'));
  assert.equal(newFlow.title, 'Custom Architect Flow');
  assert.equal(newFlow.isBuiltIn, false);
  assert.equal(newFlow.steps.length, 1, 'New flow must initialize with 1 default step');

  // Verify it exists in store
  let allFlows = loadFlows();
  assert.ok(allFlows.some(f => f.id === newFlow.id));

  // 2. Update / Save Flow
  const updated = saveFlow({
    id: newFlow.id,
    title: 'Renamed Architect Pipeline',
    steps: [
      ...newFlow.steps,
      {
        id: generateStepId(1),
        title: 'Step 2: Database Schema',
        instruction: 'Design Postgres schema for {{step1}}',
        provider: 'groq',
        model: 'qwen/qwen3.8-27b'
      }
    ]
  });
  assert.equal(updated.title, 'Renamed Architect Pipeline');
  assert.equal(updated.steps.length, 2);

  // 3. Duplicate Flow
  const duplicated = duplicateFlow(newFlow.id);
  assert.ok(duplicated.id.startsWith('flow_'));
  assert.notEqual(duplicated.id, newFlow.id);
  assert.ok(duplicated.title.includes('(Copy)'));
  assert.equal(duplicated.steps.length, 2);
  assert.notEqual(duplicated.steps[0].id, updated.steps[0].id, 'Step IDs must also be fresh in duplicate');

  // 4. Delete Flow
  deleteFlow(newFlow.id);
  allFlows = loadFlows();
  assert.ok(!allFlows.some(f => f.id === newFlow.id), 'Deleted flow must no longer be present');
});

test('1.1.6: exportFlowsJSON and importFlowsJSON validate schema and prevent secret leak', () => {
  mockStore.clear();
  const created = createFlow({
    title: 'Exportable Pipeline',
    category: 'Productivity'
  });

  // Export single flow
  const jsonExport = exportFlowsJSON([created.id]);
  assert.ok(typeof jsonExport === 'string');

  const parsed = JSON.parse(jsonExport);
  assert.equal(parsed.schemaVersion, FLOW_SCHEMA_VERSION);
  assert.equal(parsed.flows.length, 1);
  assert.equal(parsed.flows[0].title, 'Exportable Pipeline');

  // Inject accidental secret into import to verify sanitization
  parsed.flows[0].apiKey = 'sk-leaked-secret';
  parsed.flows[0].steps[0].apiKey = 'sk-step-secret';

  // Import into clean storage
  mockStore.clear();
  const importResult = importFlowsJSON(JSON.stringify(parsed));
  assert.equal(importResult.success, true);
  assert.equal(importResult.importedCount, 1);

  const importedFlows = loadFlows();
  const found = importedFlows.find(f => f.title === 'Exportable Pipeline');
  assert.ok(found);
  assert.equal(found.apiKey, undefined, 'Accidental apiKey on flow must be stripped');
  assert.equal(found.steps[0].apiKey, undefined, 'Accidental apiKey on step must be stripped');

  // Malformed JSON rejection
  assert.equal(importFlowsJSON('{ invalid json').success, false);
  assert.equal(importFlowsJSON(JSON.stringify({ schemaVersion: 'pecut.flow.v2', flows: [] })).success, false);
});
