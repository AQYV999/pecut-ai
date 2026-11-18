import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStepExecutionConfig,
  resolveContextProfilePrompt,
  executeWorkflowPipeline
} from '../src/modules/flow/engine.js';
import { normalizeFlowV2 } from '../src/modules/flow/schema.js';

test('1.3.1: resolveStepExecutionConfig resolves inherit vs explicit provider override correctly', () => {
  const activeConfig = {
    provider: 'openrouter',
    apiKey: 'sk-active-openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    baseUrl: 'https://openrouter.ai/api/v1'
  };

  const savedProfiles = {
    groq: {
      provider: 'groq',
      apiKey: 'gsk_saved_groq_key',
      model: 'qwen/qwen3.8-27b',
      baseUrl: 'https://api.groq.com/openai/v1'
    }
  };

  // Case A: Step inherits active config
  const inheritStep = { provider: 'inherit', model: 'inherit', temperature: 0.2, maxTokens: 2048 };
  const confA = resolveStepExecutionConfig(inheritStep, activeConfig, savedProfiles);
  assert.equal(confA.provider, 'openrouter');
  assert.equal(confA.apiKey, 'sk-active-openrouter');
  assert.equal(confA.model, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(confA.temperature, 0.2);
  assert.equal(confA.maxTokens, 2048);

  // Case B: Step explicitly overrides provider to Groq
  const overrideStep = { provider: 'groq', model: 'inherit', temperature: 0.4, maxTokens: 4096 };
  const confB = resolveStepExecutionConfig(overrideStep, activeConfig, savedProfiles);
  assert.equal(confB.provider, 'groq');
  assert.equal(confB.apiKey, 'gsk_saved_groq_key');
  assert.equal(confB.model, 'qwen/qwen3.8-27b');
  assert.equal(confB.temperature, 0.4);
});

test('1.3.2: resolveContextProfilePrompt extracts persona and handles inheritance and none', () => {
  const profiles = [
    {
      id: 'prof-dev',
      name: 'Fullstack Dev',
      role: 'Staff Engineer',
      tone: 'Concise',
      context: 'TypeScript backend',
      constraints: 'Never use any'
    }
  ];

  // Case A: Flow default profile
  const promptA = resolveContextProfilePrompt('inherit', 'prof-dev', profiles);
  assert.ok(promptA.includes('Staff Engineer'));
  assert.ok(promptA.includes('Never use any'));

  // Case B: Explicit none overrides flow default
  const promptB = resolveContextProfilePrompt('none', 'prof-dev', profiles);
  assert.equal(promptB, '');

  // Case C: Unmatched profile returns empty string
  const promptC = resolveContextProfilePrompt('non-existent', '', profiles);
  assert.equal(promptC, '');
});

test('1.3.3: executeWorkflowPipeline runs sequential multi-step flow using mocked transport', async () => {
  const flow = normalizeFlowV2({
    title: 'Multi-Model Mock Test',
    steps: [
      { id: 's1', title: 'Step 1: Ideation', instruction: 'Ideate hooks for {{input}}' },
      { id: 's2', title: 'Step 2: Outline', instruction: 'Build outline from {{prev}}' },
      { id: 's3', title: 'Step 3: Review', instruction: 'Review {{step1}} and {{step2}}' }
    ]
  });

  const executedCalls = [];
  const mockTransport = async (options) => {
    executedCalls.push(options);
    const stepNum = executedCalls.length;
    return {
      text: `Output of Step ${stepNum}`,
      model: options.overrideConfig?.model || 'mock-model',
      provider: options.overrideConfig?.provider || 'mock-provider',
      usage: { promptTokens: 10 * stepNum, completionTokens: 20 * stepNum, totalTokens: 30 * stepNum }
    };
  };

  const startEvents = [];
  const successEvents = [];

  const runResult = await executeWorkflowPipeline({
    flow,
    input: 'Build Autonomous AI Agent',
    activeConfig: { provider: 'openrouter', apiKey: 'test', model: 'test' },
    transportFn: mockTransport,
    callbacks: {
      onStepStart: (info) => startEvents.push(info),
      onStepSuccess: (res) => successEvents.push(res)
    }
  });

  assert.equal(runResult.success, true);
  assert.equal(runResult.results.length, 3);
  assert.equal(executedCalls.length, 3);
  assert.equal(startEvents.length, 3);
  assert.equal(successEvents.length, 3);

  // Verify sequential variable chaining across mock calls
  assert.ok(executedCalls[0].messages[0].content.includes('Build Autonomous AI Agent'));
  assert.ok(executedCalls[1].messages[0].content.includes('Output of Step 1'));
  assert.ok(executedCalls[2].messages[0].content.includes('Output of Step 1'));
  assert.ok(executedCalls[2].messages[0].content.includes('Output of Step 2'));
});

test('1.3.4: executeWorkflowPipeline halts on step failure, preserves partial results, and does NOT fallback to mock silently', async () => {
  const flow = normalizeFlowV2({
    title: 'Failure Test',
    steps: [
      { id: 's1', title: 'Step 1', instruction: 'Step 1 {{input}}' },
      { id: 's2', title: 'Step 2 (Failing)', instruction: 'Step 2 {{prev}}' },
      { id: 's3', title: 'Step 3 (Should Not Run)', instruction: 'Step 3 {{prev}}' }
    ]
  });

  const mockTransport = async (options) => {
    if (options.messages[0].content.includes('Step 2')) {
      throw new Error('Upstream HTTP 429: Rate limit exceeded');
    }
    return { text: 'Step 1 Success', usage: { totalTokens: 25 } };
  };

  let caughtError = null;
  try {
    await executeWorkflowPipeline({
      flow,
      input: 'Test Failure',
      activeConfig: { provider: 'openrouter', apiKey: 'test', model: 'test' },
      transportFn: mockTransport
    });
  } catch (err) {
    caughtError = err;
  }

  assert.ok(caughtError, 'Must throw error instead of swallowing into demo mock');
  assert.ok(caughtError.message.includes('Rate limit exceeded'));
  assert.equal(caughtError.failedStepIndex, 1, 'Failed step index must be 1 (Step 2)');
  assert.ok(Array.isArray(caughtError.partialResults), 'Must attach partialResults to error');
  assert.equal(caughtError.partialResults.length, 1, 'Must preserve Step 1 output');
  assert.equal(caughtError.partialResults[0].output, 'Step 1 Success');
});

test('1.3.5: executeWorkflowPipeline aborts immediately when AbortSignal is cancelled', async () => {
  const flow = normalizeFlowV2({
    title: 'Abort Flow',
    steps: [
      { id: 's1', title: 'Step 1', instruction: 'Do 1 {{input}}' },
      { id: 's2', title: 'Step 2', instruction: 'Do 2 {{prev}}' }
    ]
  });

  const controller = new AbortController();

  const mockTransport = async (options) => {
    // Abort controller during step 1 execution
    controller.abort();
    return { text: 'Step 1 Finished' };
  };

  await assert.rejects(
    async () => {
      await executeWorkflowPipeline({
        flow,
        input: 'Abort Test',
        signal: controller.signal,
        activeConfig: { provider: 'openrouter', apiKey: 'test', model: 'test' },
        transportFn: mockTransport
      });
    },
    (err) => err.name === 'AbortError' || err.message.includes('abort')
  );
});

test('1.3.6: executeWorkflowPipeline supports resume execution starting from step k', async () => {
  const flow = normalizeFlowV2({
    title: 'Resume Flow',
    steps: [
      { id: 's1', title: 'Step 1', instruction: 'Do 1' },
      { id: 's2', title: 'Step 2', instruction: 'Do 2 with {{prev}}' },
      { id: 's3', title: 'Step 3', instruction: 'Finalize with {{prev}}' }
    ]
  });

  // Step 1 was already completed previously
  const priorResults = [
    {
      stepIndex: 0,
      stepId: flow.steps[0].id,
      title: 'Step 1',
      output: 'Pre-computed Step 1 Output',
      provider: 'gemini',
      model: 'gemini-3.8-flash'
    }
  ];

  const executedSteps = [];
  const mockTransport = async (options) => {
    executedSteps.push(options);
    return { text: `Resumed output ${executedSteps.length + 1}` };
  };

  const resumedResult = await executeWorkflowPipeline({
    flow,
    input: 'Resume Requirement',
    startIndex: 1, // Resume starting from Step 2
    initialStepOutputs: priorResults,
    activeConfig: { provider: 'openrouter', apiKey: 'test', model: 'test' },
    transportFn: mockTransport
  });

  assert.equal(resumedResult.success, true);
  // Total results should include the pre-computed step + the 2 resumed steps
  assert.equal(resumedResult.results.length, 3);
  assert.equal(resumedResult.results[0].output, 'Pre-computed Step 1 Output');
  assert.equal(executedSteps.length, 2, 'Transport should only be called for steps 2 and 3');

  // Verify Step 2 received the pre-computed output
  assert.ok(executedSteps[0].messages[0].content.includes('Pre-computed Step 1 Output'));
});
