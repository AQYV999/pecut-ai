import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasTemplateVariables,
  extractPlaceholders,
  interpolateStepPrompt
} from '../src/modules/flow/interpolation.js';

test('1.2.1: hasTemplateVariables detects presence of variable tags accurately', () => {
  assert.equal(hasTemplateVariables('Analyze this: {{input}}'), true);
  assert.equal(hasTemplateVariables('Refine the draft: {{prev}}'), true);
  assert.equal(hasTemplateVariables('Combine {{step1}} and {{step2}}'), true);
  assert.equal(hasTemplateVariables('Refer to stable {{step:step_1_arch}}'), true);
  assert.equal(hasTemplateVariables('Plain instruction without any braces'), false);
  assert.equal(hasTemplateVariables('Braces with spaces { {input} } or single {input}'), false);
});

test('1.2.2: extractPlaceholders returns distinct set of referenced variables', () => {
  const text = 'Compare {{input}} with {{step1}} and {{step2}}, then polish {{step1}}. Also check {{step:step_db_1}}';
  const tags = extractPlaceholders(text);
  assert.deepEqual(tags.sort(), ['step1', 'step2', 'step:step_db_1', 'input'].sort());
});

test('1.2.3: interpolateStepPrompt replaces {{input}}, {{prev}}, and 1-based {{stepN}} deterministically', () => {
  const instruction = 'Task: Combine seed {{input}} with outline {{step1}} and draft {{prev}}.';
  const context = {
    input: 'AI Workflow Engine',
    prev: 'Draft generated in Step 2',
    stepOutputs: [
      'Outline generated in Step 1',
      'Draft generated in Step 2'
    ],
    stepIndex: 2
  };

  const result = interpolateStepPrompt(instruction, context);

  assert.equal(result.autoAppended, false, 'Should not auto-append when template variables are explicitly used');
  assert.ok(result.prompt.includes('Combine seed AI Workflow Engine with outline Outline generated in Step 1 and draft Draft generated in Step 2.'));
});

test('1.2.4: interpolateStepPrompt resolves stable step IDs via {{step:id}}', () => {
  const instruction = 'Verify database schema: {{step:step_arch_spec}} against user req: {{input}}';
  const context = {
    input: 'Build a multi-tenant chat app',
    prev: '',
    stepMap: {
      'step_arch_spec': 'Table `workspaces` (id, user_id, name); Table `messages` (id, content);'
    },
    stepIndex: 1
  };

  const result = interpolateStepPrompt(instruction, context);

  assert.equal(result.autoAppended, false);
  assert.ok(result.prompt.includes('Table `workspaces` (id, user_id, name)'));
  assert.ok(result.prompt.includes('Build a multi-tenant chat app'));
});

test('1.2.5: interpolateStepPrompt handles missing or future step references gracefully', () => {
  const instruction = 'Evaluate {{step99}} and {{step:non_existent_id}}';
  const context = {
    input: 'Topic',
    prev: 'Prev output',
    stepOutputs: ['Output 1'],
    stepIndex: 1
  };

  const result = interpolateStepPrompt(instruction, context);
  // Unresolved future/missing step variables resolve to empty string rather than throwing
  assert.ok(!result.prompt.includes('{{step99}}'));
  assert.ok(!result.prompt.includes('{{step:non_existent_id}}'));
});

test('1.2.6: Explicit auto-append behavior when NO template variables are present (backward-compatible)', () => {
  const instruction = 'Write unit tests covering edge cases and recovery.';

  // Case A: Step 1 (stepIndex 0) -> appends [WORKFLOW INPUT]
  const resStep1 = interpolateStepPrompt(instruction, {
    input: 'Authentication Module',
    prev: '',
    stepIndex: 0
  });
  assert.equal(resStep1.autoAppended, true);
  assert.ok(resStep1.prompt.startsWith('Write unit tests covering edge cases and recovery.'));
  assert.ok(resStep1.prompt.includes('\n\n[WORKFLOW INPUT]\nAuthentication Module'));
  assert.ok(!resStep1.prompt.includes('[PREVIOUS STEP OUTPUT]'));

  // Case B: Step 2+ (stepIndex > 0) -> appends [WORKFLOW INPUT] and [PREVIOUS STEP OUTPUT]
  const resStep2 = interpolateStepPrompt(instruction, {
    input: 'Authentication Module',
    prev: 'export function login() { ... }',
    stepIndex: 1
  });
  assert.equal(resStep2.autoAppended, true);
  assert.ok(resStep2.prompt.includes('\n\n[WORKFLOW INPUT]\nAuthentication Module'));
  assert.ok(resStep2.prompt.includes('\n\n[PREVIOUS STEP OUTPUT]\nexport function login() { ... }'));
});

test('1.2.7: interpolateStepPrompt handles case-insensitive {{PREV}} and {{previous}} aliases', () => {
  const context = {
    input: 'Topic',
    prev: 'Prior Step Results',
    stepIndex: 1
  };

  const resUpper = interpolateStepPrompt('Analyze {{PREV}} thoroughly', context);
  assert.equal(resUpper.autoAppended, false);
  assert.equal(resUpper.prompt, 'Analyze Prior Step Results thoroughly');

  const resPrevious = interpolateStepPrompt('Refine {{previous}} output', context);
  assert.equal(resPrevious.autoAppended, false);
  assert.equal(resPrevious.prompt, 'Refine Prior Step Results output');
});
