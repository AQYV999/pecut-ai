import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePromptLocally } from '../src/modules/optimizer.js';

test('analyzePromptLocally detects structured sections and metrics accurately', () => {
  const structuredPrompt = `
Role: Senior Architect
Objective: Audit system architecture
Context: Production banking application
Instructions:
1. Review security
2. Review throughput
Constraints: Do not use third party cookies
Output Format: Markdown Report
  `.trim();

  const metrics = analyzePromptLocally(structuredPrompt);
  assert.equal(metrics.hasRole, true);
  assert.equal(metrics.hasOutput, true);
  assert.equal(metrics.hasConstraints, true);
  assert.ok(metrics.sections.includes('Role/Persona'));
  assert.ok(metrics.sections.includes('Objective'));
  assert.ok(metrics.sections.includes('Instructions'));
  assert.ok(metrics.sections.includes('Constraints'));
  assert.ok(metrics.sections.includes('Output Format'));
  assert.equal(metrics.vagueHits, 0);
  assert.ok(metrics.words > 15);
});

test('analyzePromptLocally catches unstructured, vague prompts', () => {
  const vaguePrompt = 'buatkan artikel yang bagus dan lengkap';
  const metrics = analyzePromptLocally(vaguePrompt);

  assert.equal(metrics.hasRole, false);
  assert.equal(metrics.hasOutput, false);
  assert.equal(metrics.hasConstraints, false);
  assert.ok(metrics.vagueHits >= 2); // 'bagus' and 'lengkap'
});
