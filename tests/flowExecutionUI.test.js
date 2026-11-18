import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  executeWorkflowPipeline
} from '../src/modules/flow/engine.js';
import {
  createRunSnapshot,
  saveFlowRun,
  loadFlowRuns,
  getFlowRunById
} from '../src/modules/flow/runStorage.js';
import { normalizeFlowV2 } from '../src/modules/flow/schema.js';

// Setup Mock LocalStorage
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStore.get(k) || null,
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

test('2.3.1: Sequential multi-step execution with progress telemetry and token accumulation', async () => {
  const flow = normalizeFlowV2({
    title: 'Telemetry Test Flow',
    steps: [
      { id: 's1', title: 'Step 1: Parse', instruction: 'Parse input: {{input}}' },
      { id: 's2', title: 'Step 2: Synthesize', instruction: 'Synthesize from {{prev}}' },
      { id: 's3', title: 'Step 3: Polish', instruction: 'Polish {{prev}}' }
    ]
  });

  const executedCalls = [];
  const startLogs = [];
  const successLogs = [];

  const mockTransport = async (options) => {
    executedCalls.push(options);
    const stepNum = executedCalls.length;
    return {
      text: `Step ${stepNum} Result`,
      provider: 'mock-provider',
      model: 'mock-model',
      usage: { promptTokens: 100 * stepNum, completionTokens: 50 * stepNum, totalTokens: 150 * stepNum }
    };
  };

  const runResult = await executeWorkflowPipeline({
    flow,
    input: 'Root topic',
    activeConfig: { provider: 'openrouter', apiKey: 'test-key', model: 'test-model' },
    transportFn: mockTransport,
    callbacks: {
      onStepStart: (info) => startLogs.push(info),
      onStepSuccess: (record) => successLogs.push(record)
    }
  });

  assert.equal(runResult.success, true);
  assert.equal(runResult.results.length, 3);
  assert.equal(startLogs.length, 3);
  assert.equal(successLogs.length, 3);

  // Check token accumulation
  const totalTokens = successLogs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0);
  assert.equal(totalTokens, 150 + 300 + 450); // 900 tokens

  // Check per-step latency recorded
  assert.ok(typeof successLogs[0].latencyMs === 'number');
});

test('2.3.2: Immediate cancellation via AbortSignal preserves partial results and marks as cancelled', async () => {
  mockStore.clear();

  const flow = normalizeFlowV2({
    title: 'Cancellation Test Flow',
    steps: [
      { id: 's1', title: 'Step 1: Rapid', instruction: 'Fast step {{input}}' },
      { id: 's2', title: 'Step 2: Slow', instruction: 'Slow step {{prev}}' },
      { id: 's3', title: 'Step 3: Downstream', instruction: 'Never reached {{prev}}' }
    ]
  });

  const abortController = new AbortController();
  let step1Finished = false;

  const mockTransport = async (options) => {
    if (options.messages[0].content.includes('Fast step')) {
      step1Finished = true;
      return { text: 'Step 1 Complete', usage: { totalTokens: 10 } };
    }
    if (options.messages[0].content.includes('Slow step')) {
      // Abort while Step 2 is inflight
      abortController.abort();
      if (options.signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
    }
    return { text: 'Step 2 Complete' };
  };

  let caughtErr = null;
  try {
    await executeWorkflowPipeline({
      flow,
      input: 'Task input',
      signal: abortController.signal,
      activeConfig: { provider: 'openrouter', apiKey: 'test-key', model: 'test-model' },
      transportFn: mockTransport
    });
  } catch (err) {
    caughtErr = err;
  }

  assert.ok(caughtErr, 'Should throw AbortError');
  assert.equal(caughtErr.name, 'AbortError');
  assert.equal(caughtErr.failedStepIndex, 1, 'Should fail at Step 2 (index 1)');
  assert.ok(Array.isArray(caughtErr.partialResults), 'Must preserve partial results');
  assert.equal(caughtErr.partialResults.length, 1, 'Must have preserved Step 1 output');
  assert.equal(caughtErr.partialResults[0].output, 'Step 1 Complete');

  // Verify run record saved with cancelled status
  const runRecord = saveFlowRun({
    id: 'run_cancelled_test',
    flowId: flow.id,
    status: 'cancelled',
    stepResults: caughtErr.partialResults
  });
  assert.equal(runRecord.status, 'cancelled');
  assert.equal(runRecord.stepResults.length, 1);
});

test('2.3.3: Retry Step executes ONLY the single failed step and does NOT auto-run downstream steps', async () => {
  const flow = normalizeFlowV2({
    title: 'Retry Test Flow',
    steps: [
      { id: 's1', title: 'Step 1', instruction: 'Step 1 {{input}}' },
      { id: 's2', title: 'Step 2 (Failed)', instruction: 'Step 2 {{prev}}' },
      { id: 's3', title: 'Step 3 (Downstream)', instruction: 'Step 3 {{prev}}' }
    ]
  });

  const existingStep1Output = {
    stepIndex: 0,
    stepId: 's1',
    title: 'Step 1',
    output: 'Step 1 Pre-existing Output',
    usage: { totalTokens: 20 }
  };

  const executedSteps = [];
  const mockTransport = async (options) => {
    executedSteps.push(options);
    return {
      text: 'Step 2 Successfully Retried',
      usage: { totalTokens: 50 }
    };
  };

  // Run with startIndex = 1, singleStepOnly = true
  const retryResult = await executeWorkflowPipeline({
    flow,
    input: 'Original Input',
    startIndex: 1,
    initialStepOutputs: [existingStep1Output],
    singleStepOnly: true,
    activeConfig: { provider: 'openrouter', apiKey: 'test-key', model: 'test-model' },
    transportFn: mockTransport
  });

  assert.equal(retryResult.success, true);
  // Only Step 2 was executed
  assert.equal(executedSteps.length, 1, 'Must only execute Step 2');
  assert.ok(executedSteps[0].messages[0].content.includes('Step 1 Pre-existing Output'), 'Step 2 must use Step 1 output');

  // Step 3 was NOT run
  assert.equal(retryResult.results.length, 2);
  assert.equal(retryResult.results[1].output, 'Step 2 Successfully Retried');
});

test('2.3.4: Resume Pipeline resumes from failed step and continues through all downstream steps to completion', async () => {
  const flow = normalizeFlowV2({
    title: 'Resume Test Flow',
    steps: [
      { id: 's1', title: 'Step 1', instruction: 'Step 1 {{input}}' },
      { id: 's2', title: 'Step 2', instruction: 'Step 2 {{prev}}' },
      { id: 's3', title: 'Step 3', instruction: 'Step 3 {{prev}}' }
    ]
  });

  const initialStepOutputs = [
    {
      stepIndex: 0,
      stepId: 's1',
      title: 'Step 1',
      output: 'Step 1 Cached Result',
      usage: { totalTokens: 30 }
    }
  ];

  const executedSteps = [];
  const mockTransport = async (options) => {
    executedSteps.push(options);
    const num = executedSteps.length + 1; // Step 2, then Step 3
    return {
      text: `Step ${num} Resumed Output`,
      usage: { totalTokens: 50 }
    };
  };

  // Run with startIndex = 1, singleStepOnly = false (Resume)
  const resumeResult = await executeWorkflowPipeline({
    flow,
    input: 'Original Input',
    startIndex: 1,
    initialStepOutputs,
    singleStepOnly: false,
    activeConfig: { provider: 'openrouter', apiKey: 'test-key', model: 'test-model' },
    transportFn: mockTransport
  });

  assert.equal(resumeResult.success, true);
  // Step 1 was NOT re-executed
  assert.equal(executedSteps.length, 2, 'Must execute Step 2 and Step 3');
  assert.equal(resumeResult.results.length, 3, 'Must have all 3 step outputs');
  assert.equal(resumeResult.results[0].output, 'Step 1 Cached Result');
  assert.equal(resumeResult.results[1].output, 'Step 2 Resumed Output');
  assert.equal(resumeResult.results[2].output, 'Step 3 Resumed Output');
});

test('2.3.5: Resume uses immutable workflow snapshot from original run', async () => {
  mockStore.clear();

  const originalFlow = normalizeFlowV2({
    id: 'flow_snap_test',
    title: 'Original Flow Title',
    steps: [
      { id: 's1', title: 'Step 1', instruction: 'Step 1 {{input}}' },
      { id: 's2', title: 'Step 2', instruction: 'Step 2 {{prev}}' }
    ]
  });

  const snapshot = createRunSnapshot(originalFlow);

  // User later mutates original workflow in editor
  originalFlow.title = 'Mutated Workflow Title';
  originalFlow.steps[1].instruction = 'Mutated instruction {{prev}}';

  // Resume must execute against snapshot, preserving original instructions
  const executedCalls = [];
  const mockTransport = async (options) => {
    executedCalls.push(options);
    return { text: 'Done', usage: { totalTokens: 10 } };
  };

  await executeWorkflowPipeline({
    flow: snapshot, // Uses snapshot
    input: 'Seed input',
    startIndex: 1,
    initialStepOutputs: [{ stepIndex: 0, stepId: 's1', output: 'Step 1 Output' }],
    activeConfig: { provider: 'openrouter', apiKey: 'test-key', model: 'test-model' },
    transportFn: mockTransport
  });

  assert.equal(executedCalls.length, 1);
  // Instruction should match original snapshot, NOT mutated flow
  assert.ok(executedCalls[0].messages[0].content.includes('Step 2 Step 1 Output'));
  assert.ok(!executedCalls[0].messages[0].content.includes('Mutated instruction'));
});

test('2.3.6: Step failures report informative error details without silent fallback', async () => {
  const flow = normalizeFlowV2({
    title: 'Provider Error Flow',
    steps: [
      { id: 's1', title: 'Step 1', instruction: 'Step 1 {{input}}' }
    ]
  });

  const errorTransport = async () => {
    const err = new Error('HTTP 429: Provider rate limit exceeded. Retry after 20 seconds.');
    err.status = 429;
    throw err;
  };

  let caughtErr = null;
  try {
    await executeWorkflowPipeline({
      flow,
      input: 'Test input',
      activeConfig: { provider: 'groq', apiKey: 'gsk_test', model: 'qwen' },
      transportFn: errorTransport
    });
  } catch (err) {
    caughtErr = err;
  }

  assert.ok(caughtErr);
  assert.ok(caughtErr.message.includes('HTTP 429'));
  assert.ok(caughtErr.message.includes('rate limit exceeded'));
  assert.equal(caughtErr.failedStepIndex, 0);
  assert.equal(caughtErr.failedStepId, 's1');
});
