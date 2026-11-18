import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStepExecutionConfig,
  resolveContextProfilePrompt,
  executeWorkflowPipeline
} from '../src/modules/flow/engine.js';
import {
  validateStepParameters,
  validateContextProfiles,
  validateProviderCredentials
} from '../src/modules/flow/validation.js';
import {
  normalizeStepV2,
  normalizeFlowV2,
  validateFlowV2
} from '../src/modules/flow/schema.js';
import {
  saveFlow,
  loadFlows,
  exportFlowsJSON,
  importFlowsJSON
} from '../src/modules/flow/storage.js';
import { createRunSnapshot } from '../src/modules/flow/runStorage.js';

// Setup Mock LocalStorage
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStore.get(k) || null,
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

test('2.2.1: Provider inheritance resolves active BYOK provider, key, baseUrl, and model', () => {
  const activeConfig = {
    provider: 'openrouter',
    apiKey: 'sk-active-or-key',
    model: 'anthropic/claude-3.5-sonnet',
    baseUrl: 'https://openrouter.ai/api/v1'
  };

  const step = {
    provider: 'inherit',
    model: 'inherit',
    temperature: 0.5,
    maxTokens: 2048
  };

  const resolved = resolveStepExecutionConfig(step, activeConfig, {});
  assert.equal(resolved.provider, 'openrouter');
  assert.equal(resolved.apiKey, 'sk-active-or-key');
  assert.equal(resolved.model, 'anthropic/claude-3.5-sonnet');
  assert.equal(resolved.baseUrl, 'https://openrouter.ai/api/v1');
  assert.equal(resolved.temperature, 0.5);
  assert.equal(resolved.maxTokens, 2048);
  assert.equal(resolved.hasCredential, true);
});

test('2.2.2: Explicit provider override resolves profile credentials and provider default model', () => {
  const activeConfig = {
    provider: 'openrouter',
    apiKey: 'sk-active-or-key',
    model: 'meta-llama/llama-3.3-70b-instruct:free'
  };

  const savedProfiles = {
    gemini: {
      provider: 'gemini',
      apiKey: 'AIzaSy-gemini-override-key',
      model: 'gemini-3.8-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
    }
  };

  // Step explicitly configured with Gemini
  const step = {
    provider: 'gemini',
    model: 'inherit', // Should resolve to gemini default or profile model
    temperature: 0.2,
    maxTokens: 4096
  };

  const resolved = resolveStepExecutionConfig(step, activeConfig, savedProfiles);
  assert.equal(resolved.provider, 'gemini');
  assert.equal(resolved.apiKey, 'AIzaSy-gemini-override-key');
  assert.equal(resolved.model, 'gemini-3.8-flash');
  assert.equal(resolved.hasCredential, true);
});

test('2.2.3: Model compatibility resolves specific compatible model overrides', () => {
  const activeConfig = {
    provider: 'groq',
    apiKey: 'gsk_groq_key',
    model: 'qwen/qwen3.8-27b'
  };

  const step = {
    provider: 'groq',
    model: 'deepseek-r1-distill-llama-70b',
    temperature: 0.7,
    maxTokens: 8192
  };

  const resolved = resolveStepExecutionConfig(step, activeConfig, {});
  assert.equal(resolved.provider, 'groq');
  assert.equal(resolved.model, 'deepseek-r1-distill-llama-70b');
  assert.equal(resolved.temperature, 0.7);
  assert.equal(resolved.maxTokens, 8192);
});

test('2.2.4: Keyless 9Router and Ollama/Custom mark hasCredential as true even with empty API key', () => {
  // Case A: 9Router without API key
  const step9Router = { provider: 'ninerouter', model: 'VibeCoding' };
  const res9 = resolveStepExecutionConfig(step9Router, {}, {});
  assert.equal(res9.provider, 'ninerouter');
  assert.equal(res9.isKeyless, true);
  assert.equal(res9.hasCredential, true);

  // Case B: Ollama/Custom without API key
  const stepCustom = { provider: 'custom', model: 'llama3:latest' };
  const resCust = resolveStepExecutionConfig(stepCustom, {}, {});
  assert.equal(resCust.provider, 'custom');
  assert.equal(resCust.isKeyless, true);
  assert.equal(resCust.hasCredential, true);
});

test('2.2.5: Missing provider credentials fails fast with descriptive error and does NOT fallback silently', async () => {
  const flow = normalizeFlowV2({
    title: 'Missing Key Flow',
    steps: [
      { id: 's1', title: 'Step 1 (OpenAI)', instruction: 'Analyze {{input}}', provider: 'openai', model: 'gpt-4o' }
    ]
  });

  // Empty savedProfiles and empty activeConfig
  const activeConfig = { provider: 'openrouter', apiKey: '' };
  const savedProfiles = {};

  let caughtErr = null;
  try {
    await executeWorkflowPipeline({
      flow,
      input: 'Task input',
      activeConfig,
      savedProfiles,
      transportFn: async () => ({ text: 'Should not run' })
    });
  } catch (err) {
    caughtErr = err;
  }

  assert.ok(caughtErr, 'Engine must throw when provider credentials are missing');
  assert.ok(caughtErr.message.includes('Missing API Key for provider "openai"'));
  assert.equal(caughtErr.failedStepIndex, 0);
});

test('2.2.6: Context Profile inheritance, none, and specific profiles format persona cleanly', () => {
  const profiles = [
    {
      id: 'prof-arch',
      name: 'Software Architect',
      role: 'Principal Architect',
      tone: 'Precise & Rigorous',
      context: 'Distributed Systems',
      constraints: 'Always define latency bounds'
    },
    {
      id: 'prof-sec',
      name: 'Security Auditor',
      role: 'Lead AppSec Engineer',
      tone: 'Strict',
      context: 'OWASP Top 10',
      constraints: 'Zero trust'
    }
  ];

  // Case A: Step inherits workflow default
  const promptA = resolveContextProfilePrompt('inherit', 'prof-arch', profiles);
  assert.ok(promptA.includes('Principal Architect'));
  assert.ok(promptA.includes('Always define latency bounds'));

  // Case B: Step explicitly opts out with 'none'
  const promptB = resolveContextProfilePrompt('none', 'prof-arch', profiles);
  assert.equal(promptB, '');

  // Case C: Step explicitly picks specific profile
  const promptC = resolveContextProfilePrompt('prof-sec', 'prof-arch', profiles);
  assert.ok(promptC.includes('Lead AppSec Engineer'));
  assert.ok(!promptC.includes('Principal Architect'));
});

test('2.2.7: validateContextProfiles detects deleted or missing context profiles', () => {
  const availableProfiles = [{ id: 'prof_existing', name: 'Existing Profile' }];

  const flowWithDeletedProfile = {
    id: 'f1',
    defaultContextProfileId: 'prof_deleted_default',
    steps: [
      { id: 's1', contextProfileId: 'inherit' },
      { id: 's2', contextProfileId: 'prof_deleted_step' },
      { id: 's3', contextProfileId: 'none' }
    ]
  };

  const validation = validateContextProfiles(flowWithDeletedProfile, availableProfiles);
  assert.equal(validation.isValid, false);
  assert.equal(validation.warnings.length, 2);
  assert.ok(validation.warnings.some(w => w.profileId === 'prof_deleted_default'));
  assert.ok(validation.warnings.some(w => w.profileId === 'prof_deleted_step'));
});

test('2.2.8: Temperature and maxTokens validation enforces parameter bounds', () => {
  // Valid steps
  const validSteps = [
    { id: 's1', temperature: 0.3, maxTokens: 4096 },
    { id: 's2', temperature: 1.8, maxTokens: 32768 }
  ];
  assert.equal(validateStepParameters(validSteps).isValid, true);

  // Invalid temperature (< 0 or > 2.0)
  const invalidTemp = [
    { id: 's1', temperature: 2.5, maxTokens: 4096 },
    { id: 's2', temperature: -0.1, maxTokens: 4096 }
  ];
  const resTemp = validateStepParameters(invalidTemp);
  assert.equal(resTemp.isValid, false);
  assert.equal(resTemp.errors.length, 2);

  // Invalid maxTokens (< 256 or > 65536)
  const invalidTokens = [
    { id: 's1', temperature: 0.5, maxTokens: 100 },
    { id: 's2', temperature: 0.5, maxTokens: 100000 }
  ];
  const resTokens = validateStepParameters(invalidTokens);
  assert.equal(resTokens.isValid, false);
  assert.equal(resTokens.errors.length, 2);

  // validateFlowV2 also catches out-of-bounds parameters
  const flowInvalid = {
    id: 'f_invalid',
    title: 'Invalid Params Flow',
    steps: [{ id: 's1', title: 'Step 1', instruction: 'Do work', temperature: 3.5, maxTokens: 50 }]
  };
  const schemaRes = validateFlowV2(flowInvalid);
  assert.equal(schemaRes.valid, false);
  assert.ok(schemaRes.errors.some(e => e.includes('temperature')));
  assert.ok(schemaRes.errors.some(e => e.includes('maxTokens')));
});

test('2.2.9: Workflow persistence preserves provider, model, context profile, and advanced params after reload', () => {
  mockStore.clear();

  const flow = {
    id: 'flow_advanced_test',
    title: 'Custom Multi-Model Pipeline',
    category: 'Engineering',
    defaultContextProfileId: 'prof-dev',
    steps: [
      {
        id: 'step_1_init',
        title: 'Architecture Strategy',
        instruction: 'Design system for {{input}}',
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        contextProfileId: 'inherit',
        temperature: 0.2,
        maxTokens: 2048
      },
      {
        id: 'step_2_code',
        title: 'Code Synthesis',
        instruction: 'Generate implementation from {{prev}}',
        provider: 'groq',
        model: 'qwen/qwen3.8-27b',
        contextProfileId: 'none',
        temperature: 0.7,
        maxTokens: 8192
      }
    ]
  };

  const saved = saveFlow(flow);
  assert.ok(saved);

  // Reload from storage
  const loadedList = loadFlows();
  const reloaded = loadedList.find(f => f.id === 'flow_advanced_test');
  assert.ok(reloaded, 'Workflow must be present after reload');
  assert.equal(reloaded.defaultContextProfileId, 'prof-dev');
  assert.equal(reloaded.steps[0].provider, 'gemini');
  assert.equal(reloaded.steps[0].model, 'gemini-3.8-flash');
  assert.equal(reloaded.steps[0].temperature, 0.2);
  assert.equal(reloaded.steps[0].maxTokens, 2048);

  assert.equal(reloaded.steps[1].provider, 'groq');
  assert.equal(reloaded.steps[1].model, 'qwen/qwen3.8-27b');
  assert.equal(reloaded.steps[1].contextProfileId, 'none');
  assert.equal(reloaded.steps[1].temperature, 0.7);
  assert.equal(reloaded.steps[1].maxTokens, 8192);
});

test('2.2.10: Credential sanitization strictly strips API keys from workflow export and snapshots', () => {
  mockStore.clear();

  const flow = {
    id: 'flow_sec_test',
    title: 'Secret Safety Workflow',
    category: 'Security',
    steps: [
      {
        id: 's1',
        title: 'Step 1',
        instruction: 'Do work',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-SHOULD-NOT-EXIST' // Intentionally injected to verify sanitization
      }
    ]
  };

  saveFlow(flow);

  // 1. Check Export JSON
  const exportedJson = exportFlowsJSON();
  assert.ok(!exportedJson.includes('sk-SHOULD-NOT-EXIST'), 'Exported JSON must never contain API keys');
  assert.ok(!exportedJson.includes('apiKey'), 'Workflow schema must not export apiKey properties');

  // 2. Check Run Snapshot
  const snapshot = createRunSnapshot(flow);
  assert.equal(snapshot.steps[0].apiKey, undefined, 'Snapshot must not contain apiKey');
  assert.ok(!JSON.stringify(snapshot).includes('sk-SHOULD-NOT-EXIST'));
});

test('2.2.11: Backward compatibility: legacy workflows without provider defaults gracefully fallback to inherit', () => {
  const legacyStep = {
    id: 'legacy_step',
    title: 'Legacy Step',
    instruction: 'Old instructions'
  };

  const normalized = normalizeStepV2(legacyStep, 0);
  assert.equal(normalized.provider, 'inherit');
  assert.equal(normalized.model, 'inherit');
  assert.equal(normalized.contextProfileId, 'inherit');
  assert.equal(normalized.temperature, 0.3);
  assert.equal(normalized.maxTokens, 4096);
});
