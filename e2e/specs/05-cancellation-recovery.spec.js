/**
 * Pecut AI — Cancellation, Retry & Resume E2E Tests
 * Suite 05: Tests cancellation, abort signals, single-step retry,
 * pipeline resume, snapshot immutability, and race conditions.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

test.describe('Cancellation, Retry & Resume', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Seed localStorage before navigation so BYOK validation and profiles succeed
    await page.addInitScript(() => {
      localStorage.setItem('pecut_byok_config', JSON.stringify({
        provider: 'openrouter',
        model: 'deepseek/deepseek-chat',
        apiKey: 'test-key-mock-valid-12345',
        baseUrl: 'https://openrouter.ai/api/v1'
      }));
      localStorage.setItem('pecut_byok_profiles', JSON.stringify({
        openrouter: {
          provider: 'openrouter',
          apiKey: 'test-key-mock-valid-12345',
          model: 'deepseek/deepseek-chat',
          baseUrl: 'https://openrouter.ai/api/v1'
        },
        gemini: {
          provider: 'gemini',
          apiKey: 'AIzaSyMockTestKey12345',
          model: 'gemini-3.8-flash',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
        },
        groq: {
          provider: 'groq',
          apiKey: 'gsk_MockTestKey12345',
          model: 'qwen/qwen3.8-27b',
          baseUrl: 'https://api.groq.com/openai/v1'
        },
        openai: {
          provider: 'openai',
          apiKey: 'sk-proj-MockTestKey12345',
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.openai.com/v1'
        },
        ninerouter: {
          provider: 'ninerouter',
          apiKey: '',
          model: 'VibeCoding',
          baseUrl: 'http://localhost:20128/v1'
        },
        custom: {
          provider: 'custom',
          apiKey: '',
          model: 'llama3:latest',
          baseUrl: 'http://localhost:11434/v1'
        }
      }));
      localStorage.setItem('pecut_profiles', JSON.stringify([
        {
          id: 'prof-1',
          name: 'B2B SaaS Growth & Marketing',
          category: 'Marketing',
          role: 'Senior B2B Growth Copywriter & Conversion Strategist',
          tone: 'Professional & Authoritative',
          context: 'Enterprise SaaS marketing',
          constraints: 'Back claims with metrics'
        },
        {
          id: 'prof-2',
          name: 'Senior TypeScript Architect',
          category: 'Programming',
          role: 'Principal Full-Stack Architect & Security Reviewer',
          tone: 'Direct, Technical & Concise',
          context: 'Production Node.js environment',
          constraints: 'Strict typing'
        }
      ]));
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await expect(page.locator('#view-flow.active')).toBeVisible();

    // Create a 3-step test workflow
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Cancellation Test Workflow');
    await page.fill('#flowEditDesc', 'Workflow for cancellation, retry and resume testing');

    // Step 0: Step 1
    await page.fill('#step-title-0', 'Step 1');
    await page.fill('#step-instruction-0', 'Process: {{input}}');

    // Step 1: Step 2
    await page.fill('#step-title-1', 'Step 2');
    await page.fill('#step-instruction-1', 'Analyze: {{prev}}');

    // Add Step 2: Step 3
    await page.click('#btnAddStepBtn');
    await page.waitForTimeout(300);
    await page.fill('#step-title-2', 'Step 3');
    await page.fill('#step-instruction-2', 'Review: {{step1}} and {{prev}}');

    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Cancellation Test Workflow")');
  });

  test('should cancel while request is running and update status to CANCELLED', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      // Delay response to ensure cancellation happens while request is in-flight
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Delayed response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Cancel test');
    await page.click('#runFlowPipelineBtn');

    // Wait for execution to start
    await expect(page.locator('#telemetryStateBadge')).toHaveText('RUNNING', { timeout: 10000 });

    // Click cancel
    await page.click('#btnCancelFlowExecution');

    // Verify status becomes CANCELLED
    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    // Verify cancel button is hidden once cancelled
    await expect(page.locator('#btnCancelFlowExecution')).toBeHidden();

    // Verify resume button is now available
    await expect(page.locator('#btnResumePipeline')).toBeVisible();
  });

  test('should verify AbortSignal reaches transport and halts in-flight execution', async ({ page }) => {
    let requestsStarted = 0;

    await page.route('**/api/ai/proxy**', async (route) => {
      requestsStarted++;
      // Long delay to simulate in-flight provider latency
      await new Promise(r => setTimeout(r, 3000));
      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Step output', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'AbortSignal halt test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('RUNNING', { timeout: 10000 });
    await page.click('#btnCancelFlowExecution');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    // Confirm that the active step was marked as cancelled
    await expect(page.locator('#step-node-0')).toHaveClass(/cancelled/);

    // Wait a brief period and ensure no downstream requests were initiated
    await page.waitForTimeout(1000);
    expect(requestsStarted).toBe(1);
    await expect(page.locator('#step-node-1')).not.toHaveClass(/running|completed|failed|cancelled/);
  });

  test('should preserve completed step outputs on cancellation', async ({ page }) => {
    let stepCount = 0;

    await page.route('**/api/ai/proxy**', async (route) => {
      stepCount++;
      if (stepCount === 1) {
        // Step 1 completes quickly
        await route.fulfill({
          json: {
            choices: [{ index: 0, message: { role: 'assistant', content: 'Step 1 complete data', reasoning: '' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
          },
        });
      } else {
        // Step 2 is delayed to allow cancellation
        await new Promise(r => setTimeout(r, 2500));
        await route.fulfill({
          json: {
            choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 data', reasoning: '' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
          },
        });
      }
    });

    await page.fill('#flowRootInput', 'Preserve output test');
    await page.click('#runFlowPipelineBtn');

    // Wait for step 1 to complete and step 2 to start running
    await expect(page.locator('#step-node-0')).toHaveClass(/completed/, { timeout: 15000 });
    await expect(page.locator('#step-node-1')).toHaveClass(/running/, { timeout: 10000 });

    // Cancel during step 2
    await page.click('#btnCancelFlowExecution');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    // Step 1 remains completed
    await expect(page.locator('#step-node-0')).toHaveClass(/completed/);
    // Step 2 shows cancelled
    await expect(page.locator('#step-node-1')).toHaveClass(/cancelled/);
    // Step 3 was never touched
    await expect(page.locator('#step-node-2')).not.toHaveClass(/completed|failed|cancelled/);

    // Verify persisted run history shows cancelled run with 1 step completed
    const historyList = page.locator('#flowRunHistoryList');
    await expect(historyList).toContainText('CANCELLED', { ignoreCase: true });
    await expect(historyList).toContainText('1 step(s) completed');

    // Click "Inspect Output" on the saved cancelled run
    await page.click('#flowRunHistoryList button:has-text("Inspect Output")');

    // Verify Step 1 tab and Consolidated tab exist and show preserved output
    await expect(page.locator('#flowResultTabs .comp-tab')).toHaveCount(2);
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Step 1 complete data');
  });

  test('should mark run as Cancelled rather than Failed in telemetry and run history', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Delayed', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Status test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('RUNNING', { timeout: 10000 });
    await page.click('#btnCancelFlowExecution');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    // Status badge is explicitly CANCELLED, not FAILED
    await expect(page.locator('#telemetryStateBadge')).not.toHaveText('FAILED');

    // Run history lists CANCELLED
    await expect(page.locator('#flowRunHistoryList')).toContainText('CANCELLED', { ignoreCase: true });
  });

  test('should not trigger automatic retry on cancellation', async ({ page }) => {
    let networkCallCount = 0;

    await page.route('**/api/ai/proxy**', async (route) => {
      networkCallCount++;
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'No auto-retry test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('RUNNING', { timeout: 10000 });
    await page.click('#btnCancelFlowExecution');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    const countAtCancel = networkCallCount;
    // Wait for 1.5 seconds to ensure no background retry loop fires
    await page.waitForTimeout(1500);
    expect(networkCallCount).toBe(countAtCancel);
  });

  test('should retry only the failed step without re-executing successful steps', async ({ page }) => {
    let step1Calls = 0;
    let step2Calls = 0;

    await page.route('**/api/ai/proxy**', async (route, request) => {
      const body = request.postDataJSON?.() || {};
      const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

      if (userPrompt.includes('Process:')) {
        step1Calls++;
        await route.fulfill({
          json: {
            choices: [{ index: 0, message: { role: 'assistant', content: 'Step 1 success', reasoning: '' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
          },
        });
      } else if (userPrompt.includes('Analyze:')) {
        step2Calls++;
        if (step2Calls === 1) {
          // First attempt fails with 500
          await route.fulfill({
            status: 500,
            json: { error: { message: 'Provider internal error' } },
          });
        } else {
          // Retry succeeds
          await route.fulfill({
            json: {
              choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 retried successfully', reasoning: '' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
            },
          });
        }
      } else {
        await route.fulfill({
          json: {
            choices: [{ index: 0, message: { role: 'assistant', content: 'Step 3 success', reasoning: '' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
          },
        });
      }
    });

    await page.fill('#flowRootInput', 'Retry isolated step');
    await page.click('#runFlowPipelineBtn');

    // Wait for Step 2 failure
    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });
    expect(step1Calls).toBe(1);
    expect(step2Calls).toBe(1);

    // Verify Retry Step 2 button is present
    await expect(page.locator('#btnRetryFailedStep')).toBeVisible();
    await expect(page.locator('#btnRetryFailedStep')).toContainText('Retry Step 2');

    // Click retry
    await page.click('#btnRetryFailedStep');

    // Wait for step 2 retry to complete
    await expect(page.locator('#step-node-1')).toHaveClass(/completed/, { timeout: 30000 });

    // Step 1 should NEVER have been called again
    expect(step1Calls).toBe(1);
    // Step 2 should have been called twice (initial fail + retry)
    expect(step2Calls).toBe(2);
  });

  test('should not auto-run downstream steps during single-step retry', async ({ page }) => {
    let step2Calls = 0;
    let step3Calls = 0;

    await page.route('**/api/ai/proxy**', async (route, request) => {
      const body = request.postDataJSON?.() || {};
      const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

      if (userPrompt.includes('Process:')) {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 1 output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      } else if (userPrompt.includes('Analyze:')) {
        step2Calls++;
        if (step2Calls === 1) {
          await route.fulfill({ status: 500, json: { error: { message: 'Temporary failure' } } });
        } else {
          await route.fulfill({
            json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 retry output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
          });
        }
      } else if (userPrompt.includes('Review:')) {
        step3Calls++;
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 3 output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      }
    });

    await page.fill('#flowRootInput', 'Single-step retry constraint');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });

    // Click retry step 2
    await page.click('#btnRetryFailedStep');
    await expect(page.locator('#step-node-1')).toHaveClass(/completed/, { timeout: 30000 });

    // Step 3 must NOT have executed automatically
    expect(step3Calls).toBe(0);
    await expect(page.locator('#step-node-2')).not.toHaveClass(/running|completed|failed|cancelled/);
  });

  test('should resume a failed pipeline from the failed step to full completion', async ({ page }) => {
    let step2Attempts = 0;

    await page.route('**/api/ai/proxy**', async (route, request) => {
      const body = request.postDataJSON?.() || {};
      const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

      if (userPrompt.includes('Process:')) {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 1 output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      } else if (userPrompt.includes('Analyze:')) {
        step2Attempts++;
        if (step2Attempts === 1) {
          await route.fulfill({ status: 500, json: { error: { message: 'Initial failure' } } });
        } else {
          await route.fulfill({
            json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 resumed output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
          });
        }
      } else if (userPrompt.includes('Review:')) {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 3 final output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      }
    });

    await page.fill('#flowRootInput', 'Resume pipeline test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });

    // Click Resume Pipeline
    await page.click('#btnResumePipeline');

    // Telemetry shows COMPLETED
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // All steps are completed
    await expect(page.locator('#step-node-0')).toHaveClass(/completed/);
    await expect(page.locator('#step-node-1')).toHaveClass(/completed/);
    await expect(page.locator('#step-node-2')).toHaveClass(/completed/);
  });

  test('should resume a cancelled pipeline from the cancelled step', async ({ page }) => {
    let step2Called = false;
    let resumeStep2Called = false;

    await page.route('**/api/ai/proxy**', async (route, request) => {
      const body = request.postDataJSON?.() || {};
      const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

      if (userPrompt.includes('Process:')) {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 1 output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      } else if (userPrompt.includes('Analyze:')) {
        if (!step2Called) {
          step2Called = true;
          // Delay to allow cancellation
          await new Promise(r => setTimeout(r, 2500));
          await route.fulfill({
            json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
          });
        } else {
          resumeStep2Called = true;
          await route.fulfill({
            json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 resumed output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
          });
        }
      } else if (userPrompt.includes('Review:')) {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 3 final output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      }
    });

    await page.fill('#flowRootInput', 'Resume from cancelled test');
    await page.click('#runFlowPipelineBtn');

    // Wait for step 1 done and step 2 running
    await expect(page.locator('#step-node-0')).toHaveClass(/completed/, { timeout: 15000 });
    await expect(page.locator('#step-node-1')).toHaveClass(/running/, { timeout: 10000 });

    // Cancel during step 2
    await page.click('#btnCancelFlowExecution');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    // Click Resume
    await expect(page.locator('#btnResumePipeline')).toBeVisible();
    await page.click('#btnResumePipeline');

    // Full completion
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });
    expect(resumeStep2Called).toBe(true);
    await expect(page.locator('#step-node-0')).toHaveClass(/completed/);
    await expect(page.locator('#step-node-1')).toHaveClass(/completed/);
    await expect(page.locator('#step-node-2')).toHaveClass(/completed/);
  });

  test('should not repeat completed steps on resume', async ({ page }) => {
    let step1Calls = 0;
    let step2Calls = 0;
    let step3Calls = 0;

    await page.route('**/api/ai/proxy**', async (route, request) => {
      const body = request.postDataJSON?.() || {};
      const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

      if (userPrompt.includes('Process:')) {
        step1Calls++;
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 1 output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      } else if (userPrompt.includes('Analyze:')) {
        step2Calls++;
        if (step2Calls === 1) {
          await route.fulfill({ status: 500, json: { error: { message: 'Step 2 failed' } } });
        } else {
          await route.fulfill({
            json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 resume', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
          });
        }
      } else if (userPrompt.includes('Review:')) {
        step3Calls++;
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 3 final', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      }
    });

    await page.fill('#flowRootInput', 'No repeat resume test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });

    expect(step1Calls).toBe(1);
    expect(step2Calls).toBe(1);

    await page.click('#btnResumePipeline');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Step 1 was not repeated (1 total call)
    expect(step1Calls).toBe(1);
    // Step 2 was called twice (initial + resume)
    expect(step2Calls).toBe(2);
    // Step 3 was called once
    expect(step3Calls).toBe(1);
  });

  test('should resume using original workflow snapshot even after editor modification', async ({ page }) => {
    let step2PromptUsed = '';
    let step2Calls = 0;

    await page.route('**/api/ai/proxy**', async (route, request) => {
      const body = request.postDataJSON?.() || {};
      const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

      if (userPrompt.includes('Process:')) {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 1 original output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      } else if (userPrompt.includes('Analyze:')) {
        step2Calls++;
        step2PromptUsed = userPrompt;
        if (step2Calls === 1) {
          await route.fulfill({ status: 500, json: { error: { message: 'Step 2 failed' } } });
        } else {
          await route.fulfill({
            json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 completed', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
          });
        }
      } else {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 3 completed', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      }
    });

    await page.fill('#flowRootInput', 'Snapshot test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });

    // Modify workflow in editor (change Step 2 instruction)
    await page.click('#flowTabEdit');
    await page.fill('#step-instruction-1', 'COMPLETELY_NEW_INSTRUCTION: {{prev}}');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    // Return to Run view and Resume
    await page.click('#flowTabRun');
    await page.click('#btnResumePipeline');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Resumed execution used the original flow snapshot instruction ('Analyze:'), not 'COMPLETELY_NEW_INSTRUCTION'
    expect(step2PromptUsed).toContain('Analyze:');
    expect(step2PromptUsed).not.toContain('COMPLETELY_NEW_INSTRUCTION');
  });

  test('should persist partial results and run state after browser reload', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route, request) => {
      const body = request.postDataJSON?.() || {};
      const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

      if (userPrompt.includes('Process:')) {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Persisted Step 1 output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      } else {
        await route.fulfill({ status: 500, json: { error: { message: 'Failure on step 2' } } });
      }
    });

    await page.fill('#flowRootInput', 'Persist reload test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await expect(page.locator('#view-flow.active')).toBeVisible();

    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Cancellation Test Workflow")');

    // Verify past run history reflects the failed run with partial steps
    const historyList = page.locator('#flowRunHistoryList');
    await expect(historyList).toContainText('FAILED', { ignoreCase: true });
    await expect(historyList).toContainText('1 step(s) completed');
  });

  test('should prevent duplicate execution on rapid repeated Run clicks', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/ai/proxy**', async (route) => {
      requestCount++;
      await new Promise(r => setTimeout(r, 600));
      await route.fulfill({
        json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
      });
    });

    await page.fill('#flowRootInput', 'Rapid clicks test');

    // Trigger multiple clicks in immediate succession
    const runBtn = page.locator('#runFlowPipelineBtn');
    await page.evaluate(() => {
      const btn = document.getElementById('runFlowPipelineBtn');
      if (btn) {
        btn.click();
        btn.click();
        btn.click();
      }
    });

    // Expect run button to be disabled while running
    await expect(runBtn).toBeDisabled();

    // Full completion
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Exactly 3 requests dispatched for the 3 steps (no duplicate pipeline invocation)
    expect(requestCount).toBe(3);
  });

  test('should prevent errors and handle rapid repeated Cancel clicks', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({
        json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
      });
    });

    await page.fill('#flowRootInput', 'Rapid cancel clicks test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('RUNNING', { timeout: 10000 });

    const cancelBtn = page.locator('#btnCancelFlowExecution');
    await cancelBtn.click();
    // Rapid secondary clicks should be harmless
    await cancelBtn.click({ force: true }).catch(() => {});
    await cancelBtn.click({ force: true }).catch(() => {});

    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });
  });

  test('should hide Retry and Resume controls while execution is actively running', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await new Promise(r => setTimeout(r, 1500));
      await route.fulfill({
        json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
      });
    });

    await page.fill('#flowRootInput', 'Controls visibility test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('RUNNING', { timeout: 10000 });

    // While running, retry and resume buttons must be hidden
    await expect(page.locator('#btnRetryFailedStep')).toBeHidden();
    await expect(page.locator('#btnResumePipeline')).toBeHidden();

    // Cancel button must be visible
    await expect(page.locator('#btnCancelFlowExecution')).toBeVisible();

    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });
  });

  test('should handle cancellation during delayed response cleanly', async ({ page }) => {
    let requestsReceived = 0;

    await page.route('**/api/ai/proxy**', async (route) => {
      requestsReceived++;
      await new Promise(r => setTimeout(r, 2000));
      try {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Delayed late output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      } catch (_) {}
    });

    await page.fill('#flowRootInput', 'Delayed cancel test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('RUNNING', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Cancel while request is lingering
    await page.click('#btnCancelFlowExecution');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    // Step 1 was cancelled, step 2 never called
    expect(requestsReceived).toBe(1);
    await expect(page.locator('#step-node-0')).toHaveClass(/cancelled/);
  });

  test('should allow cancellation during retry execution', async ({ page }) => {
    let step1Calls = 0;

    await page.route('**/api/ai/proxy**', async (route) => {
      step1Calls++;
      if (step1Calls === 1) {
        // First execution fails
        await route.fulfill({ status: 500, json: { error: { message: 'Initial step error' } } });
      } else {
        // Retry execution delayed to allow cancellation
        await new Promise(r => setTimeout(r, 2500));
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Retry late output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      }
    });

    await page.fill('#flowRootInput', 'Cancel during retry test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });

    // Click retry step 1
    await page.click('#btnRetryFailedStep');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('RUNNING', { timeout: 10000 });

    // Cancel while retry is in flight
    await page.click('#btnCancelFlowExecution');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    // Node shows cancelled
    await expect(page.locator('#step-node-0')).toHaveClass(/cancelled/);
  });

  test('should support rapid sequential state transitions (Run -> Cancel -> Resume -> Completed)', async ({ page }) => {
    let step2Executed = false;

    await page.route('**/api/ai/proxy**', async (route, request) => {
      const body = request.postDataJSON?.() || {};
      const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

      if (userPrompt.includes('Process:')) {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 1 output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      } else if (userPrompt.includes('Analyze:')) {
        if (!step2Executed) {
          step2Executed = true;
          await new Promise(r => setTimeout(r, 2500));
          await route.fulfill({
            json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
          });
        } else {
          await route.fulfill({
            json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 2 resumed output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
          });
        }
      } else {
        await route.fulfill({
          json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Step 3 final output', reasoning: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }
        });
      }
    });

    await page.fill('#flowRootInput', 'State transition cycle test');

    // 1. Run
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#step-node-0')).toHaveClass(/completed/, { timeout: 15000 });
    await expect(page.locator('#step-node-1')).toHaveClass(/running/, { timeout: 10000 });

    // 2. Cancel
    await page.click('#btnCancelFlowExecution');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    // 3. Resume
    await page.click('#btnResumePipeline');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('RUNNING', { timeout: 10000 });

    // 4. Completed
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Verify consolidated tabs exist and are selectable
    await expect(page.locator('#flowResultTabs .comp-tab')).toHaveCount(4);
    await page.click('#flowResultTabs .comp-tab:last-child');
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Step 1 output');
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Step 3 final output');
  });
});
