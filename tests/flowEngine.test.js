import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStepExecutionConfig,
  resolveContextProfilePrompt,
  executeWorkflowPipeline
} from '../src/modules/flow/engine.js';
import { normalizeFlowV2, migrateLegacyFlowToV2 } from '../src/modules/flow/schema.js';
import { DEFAULT_FLOWS } from '../src/data/flows.js';

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

test('1.3.7: DEFAULT_FLOWS[0] executes with Step 2 deterministically interpolating {{prev}} without fallback auto-append', async () => {
  const flow = migrateLegacyFlowToV2(DEFAULT_FLOWS[0]);

  const executedCalls = [];
  const startInfos = [];
  const mockTransport = async (options) => {
    executedCalls.push(options);
    const stepNum = executedCalls.length;
    return {
      text: `## Output of Step ${stepNum}\nKey insights from research.`,
      usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 }
    };
  };

  const runResult = await executeWorkflowPipeline({
    flow,
    input: 'Architecting Resilient Serverless AI Proxies in 2026',
    activeConfig: { provider: 'openrouter', apiKey: 'test-key', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    transportFn: mockTransport,
    callbacks: {
      onStepStart: (info) => startInfos.push(info)
    }
  });

  assert.equal(runResult.success, true);
  assert.equal(executedCalls.length, 3);

  // Step 1: verify {{input}} interpolation
  assert.ok(executedCalls[0].messages[0].content.includes('Architecting Resilient Serverless AI Proxies in 2026'));
  assert.ok(!executedCalls[0].messages[0].content.includes('[WORKFLOW INPUT]'), 'Step 1 should use {{input}} template tag directly, not auto-append fallback');

  // Step 2: verify {{prev}} interpolation
  assert.ok(executedCalls[1].messages[0].content.includes('Output of Step 1'));
  assert.ok(!executedCalls[1].messages[0].content.includes('[PREVIOUS STEP OUTPUT]'), 'Step 2 should interpolate {{prev}} cleanly without auto-append fallback');

  // Step 3: verify {{prev}} chaining from Step 2
  assert.ok(executedCalls[2].messages[0].content.includes('Output of Step 2'));
  assert.ok(!executedCalls[2].messages[0].content.includes('[PREVIOUS STEP OUTPUT]'), 'Step 3 should interpolate {{prev}} cleanly without auto-append fallback');
});

test('1.3.8: Custom workflow with Step 2 using {{prev}} replaces placeholder before dispatch with autoAppended=false', async () => {
  const customFlow = normalizeFlowV2({
    id: 'flow_custom_bookstore',
    title: 'Bookstore Slogan Generator',
    category: 'Creative',
    description: 'Generates creative bookstore names and paired slogans',
    isBuiltIn: false,
    steps: [
      {
        id: 'step_1_ideas',
        title: 'Nama Toko Buku',
        instruction: 'Tuliskan 2 ide nama toko buku unik dan modern.'
      },
      {
        id: 'step_2_slogan',
        title: 'Slogan Toko Buku',
        instruction: 'Buat satu slogan pendek dan menarik untuk toko buku berdasarkan ide berikut: {{prev}}'
      }
    ]
  });

  const step1Output = '1. Lentera Kata - Ruang literasi hangat dengan kurasi buku independen.\n2. Ruang Aksara - Kafe buku modern bertema minimalis urban.';
  const step2Output = '"Lentera Kata: Menyalakan Imajinasi di Setiap Sudut Ruang."';

  const dispatchedPayloads = [];
  const telemetryStartInfos = [];

  const mockTransport = async (options) => {
    dispatchedPayloads.push(options);
    if (dispatchedPayloads.length === 1) {
      return {
        text: step1Output,
        usage: { promptTokens: 25, completionTokens: 40, totalTokens: 65 }
      };
    }
    return {
      text: step2Output,
      usage: { promptTokens: 60, completionTokens: 30, totalTokens: 90 }
    };
  };

  const runResult = await executeWorkflowPipeline({
    flow: customFlow,
    input: 'Toko buku indie di Yogyakarta untuk generasi muda',
    activeConfig: { provider: 'openrouter', apiKey: 'sk-test-key', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    transportFn: mockTransport,
    callbacks: {
      onStepStart: (info) => telemetryStartInfos.push(info)
    }
  });

  // 1. Pipeline success and output verification
  assert.equal(runResult.success, true);
  assert.equal(runResult.results.length, 2);
  assert.equal(runResult.results[0].output, step1Output);
  assert.equal(runResult.results[1].output, step2Output);

  // 2. Dispatched calls count
  assert.equal(dispatchedPayloads.length, 2);

  // 3. Step 1: produces output and falls back to auto-append input since no placeholders exist
  const step1UserMessage = dispatchedPayloads[0].messages[0].content;
  assert.ok(step1UserMessage.includes('Tuliskan 2 ide nama toko buku unik dan modern.'));
  assert.ok(step1UserMessage.includes('Toko buku indie di Yogyakarta untuk generasi muda'));
  assert.equal(telemetryStartInfos[0].autoAppended, true);

  // 4. Step 2 payload audit before sending to transport
  const step2UserMessage = dispatchedPayloads[1].messages[0].content;

  // Step 2 receives the actual Step 1 output
  assert.ok(step2UserMessage.includes('1. Lentera Kata - Ruang literasi hangat dengan kurasi buku independen.'));
  assert.ok(step2UserMessage.includes('2. Ruang Aksara - Kafe buku modern bertema minimalis urban.'));

  // Placeholder {{prev}} is replaced before request is dispatched
  assert.equal(
    step2UserMessage,
    `Buat satu slogan pendek dan menarik untuk toko buku berdasarkan ide berikut: ${step1Output}`
  );

  // No literal {{prev}} or variant exists in dispatched payload
  assert.ok(!step2UserMessage.includes('{{prev}}'), 'Step 2 payload must not contain literal {{prev}}');
  assert.ok(!step2UserMessage.includes('{{PREV}}'), 'Step 2 payload must not contain uppercase {{PREV}}');
  assert.ok(!step2UserMessage.includes('{{previous}}'), 'Step 2 payload must not contain alias {{previous}}');

  // autoAppended is false
  assert.equal(telemetryStartInfos[1].autoAppended, false, 'autoAppended must be false when template variable is present');
  assert.deepEqual(telemetryStartInfos[1].usedPlaceholders, ['prev']);

  // No fallback headers appended
  assert.ok(!step2UserMessage.includes('[PREVIOUS STEP OUTPUT]'), 'Must not contain [PREVIOUS STEP OUTPUT] fallback');
  assert.ok(!step2UserMessage.includes('[WORKFLOW INPUT]'), 'Must not contain [WORKFLOW INPUT] fallback');
});
