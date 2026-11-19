/**
 * Pecut AI — Multi-Model Workflow Execution E2E Tests
 * Tests deterministic three-step workflow execution with mocked providers and transport interception.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

test.describe('Multi-Model Workflow Execution', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Seed localStorage before navigation so BYOK validation and profiles succeed
    await page.addInitScript(() => {
      localStorage.setItem('pecut_byok_config', JSON.stringify({
        provider: 'openrouter',
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        apiKey: 'test-key-mock-valid-12345',
        baseUrl: 'https://openrouter.ai/api/v1'
      }));
      localStorage.setItem('pecut_byok_profiles', JSON.stringify({
        openrouter: {
          provider: 'openrouter',
          apiKey: 'test-key-mock-valid-12345',
          model: 'meta-llama/llama-3.3-70b-instruct:free',
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
          id: 'profile_test_1',
          name: 'Senior Engineer',
          category: 'Engineering',
          role: 'Senior Full-Stack Engineer & Architecture Critic',
          tone: 'Technical & Rigorous',
          context: 'Deep expertise in system design, scalability, and code quality.',
          constraints: 'No fluff; Code examples required'
        },
        {
          id: 'profile_test_2',
          name: 'Technical Writer',
          category: 'Writing',
          role: 'Technical Documentation Specialist',
          tone: 'Professional & Authoritative',
          context: 'Expert in creating clear, structured technical documentation.',
          constraints: 'Clear headings; Step-by-step instructions'
        }
      ]));
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await expect(page.locator('#view-flow.active')).toBeVisible();

    // Create a 3-step test workflow
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Three Step Test Workflow');
    await page.fill('#flowEditDesc', 'Research → Analysis → Review');

    // Step 0: Research
    await page.fill('#step-title-0', 'Research');
    await page.fill('#step-instruction-0', 'Research the topic: {{input}}');

    // Step 1: Technical Analysis
    await page.fill('#step-title-1', 'Technical Analysis');
    await page.fill('#step-instruction-1', 'Analyze findings: {{prev}}');

    // Add Step 2: Critical Review
    await page.click('#btnAddStepBtn');
    await page.waitForTimeout(300);
    await page.fill('#step-title-2', 'Critical Review');
    await page.fill('#step-instruction-2', 'Review analysis: {{step1}} and {{prev}}');

    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Three Step Test Workflow")');

  });

  test('should execute three-step workflow in order', async ({ page }) => {
    // Set up mock responses for each step
    await page.route('**/api/ai/proxy**', async (route) => {
      const request = route.request();
      const body = request.postDataJSON?.() || {};
      const lastMsg = body.messages?.[body.messages.length - 1]?.content || '';

      let response;
      if (lastMsg.includes('Research')) {
        response = {
          choices: [{
            index: 0,
            message: { role: 'assistant', content: '## Research Results\n\nComprehensive findings for the topic.', reasoning: '' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 150, completion_tokens: 200, total_tokens: 350 },
        };
      } else if (lastMsg.includes('Analysis') || lastMsg.includes('findings')) {
        response = {
          choices: [{
            index: 0,
            message: { role: 'assistant', content: '## Technical Analysis\n\nDetailed technical specifications based on research.', reasoning: '' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 180, completion_tokens: 250, total_tokens: 430 },
        };
      } else {
        response = {
          choices: [{
            index: 0,
            message: { role: 'assistant', content: '## Critical Review\n\nReview complete with recommendations.', reasoning: 'Review reasoning here' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 160, completion_tokens: 220, total_tokens: 380 },
        };
      }

      await route.fulfill({ json: response });
    });

    // Enter input
    await page.fill('#flowRootInput', 'Test topic for workflow execution');

    // Start execution
    await page.click('#runFlowPipelineBtn');

    // Wait for execution to complete
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Verify all steps completed
    await expect(page.locator('#step-node-0')).toHaveClass(/completed/);
    await expect(page.locator('#step-node-1')).toHaveClass(/completed/);
    await expect(page.locator('#step-node-2')).toHaveClass(/completed/);

    // Verify results container is visible
    await expect(page.locator('#flowResultsContainer')).toBeVisible();

    // Verify step result tabs (3 step tabs + 1 consolidated tab = 4)
    const resultTabs = page.locator('#flowResultTabs .comp-tab');
    await expect(resultTabs).toHaveCount(4);
  });

  test('should verify input interpolation', async ({ page }) => {
    const capturedRequests = [];

    await page.route('**/api/ai/proxy**', async (route) => {
      const request = route.request();
      const body = request.postDataJSON?.() || {};
      const lastMsg = body.messages?.[body.messages.length - 1]?.content || '';
      capturedRequests.push(lastMsg);

      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Mock response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Specific test input XYZ789');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Verify first step received the input
    expect(capturedRequests[0]).toContain('Specific test input XYZ789');
    expect(capturedRequests[0]).toContain('Research');
  });

  test('should verify previous output chaining ({{prev}})', async ({ page }) => {
    const capturedRequests = [];
    let stepCount = 0;

    await page.route('**/api/ai/proxy**', async (route) => {
      const request = route.request();
      const body = request.postDataJSON?.() || {};
      const lastMsg = body.messages?.[body.messages.length - 1]?.content || '';
      capturedRequests.push(lastMsg);

      const responseText = stepCount === 0
        ? 'Step 1 Research Output Data'
        : (stepCount === 1 ? 'Step 2 Technical Analysis Data' : 'Step 3 Final Output');
      stepCount++;

      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: responseText, reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Chain test input');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Second step should contain first step's output
    expect(capturedRequests[1]).toContain('Step 1 Research Output Data');
    // Third step should contain second step's output ({{prev}}) and first step's output ({{step1}})
    expect(capturedRequests[2]).toContain('Step 2 Technical Analysis Data');
    expect(capturedRequests[2]).toContain('Step 1 Research Output Data');
  });

  test('should verify stable step references ({{step:id}})', async ({ page }) => {
    // 1. Switch to Builder to get step 0 ID and configure step 2 to reference it
    await page.click('#flowTabEdit');
    const step0Id = (await page.locator('#step-edit-card-0 .step-id-badge').textContent()).trim();
    expect(step0Id).toBeTruthy();

    await page.fill('#step-instruction-2', `Review analysis: {{step:${step0Id}}} and {{prev}}`);
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Three Step Test Workflow")');

    const capturedRequests = [];
    let stepCount = 0;

    await page.route('**/api/ai/proxy**', async (route) => {
      const request = route.request();
      const body = request.postDataJSON?.() || {};
      const lastMsg = body.messages?.[body.messages.length - 1]?.content || '';
      capturedRequests.push(lastMsg);

      const responseText = stepCount === 0
        ? 'Specialized Output from Step 0 Stable ID'
        : (stepCount === 1 ? 'Output from Step 1' : 'Output from Step 2');
      stepCount++;

      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: responseText, reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Stable ref test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Third step should resolve step 0 output via stable ID reference
    expect(capturedRequests[2]).toContain('Specialized Output from Step 0 Stable ID');
  });

  test('should support different provider/model per step', async ({ page }) => {
    // Configure different providers for each step
    await page.click('#flowTabEdit');

    // Step 0: OpenRouter
    await page.selectOption('#step-provider-0', 'openrouter');
    await page.waitForTimeout(200);

    // Step 1: Gemini
    await page.selectOption('#step-provider-1', 'gemini');
    await page.waitForTimeout(200);

    // Step 2: Groq
    await page.selectOption('#step-provider-2', 'groq');
    await page.waitForTimeout(200);

    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Three Step Test Workflow")');

    const interceptedTargetUrls = [];

    await page.route('**/api/ai/proxy**', async (route) => {
      const request = route.request();
      const targetUrl = request.headers()['x-target-url'] || '';
      interceptedTargetUrls.push(targetUrl);

      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Multi-provider test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Verify each provider endpoint was dispatched in order
    expect(interceptedTargetUrls).toHaveLength(3);
    expect(interceptedTargetUrls[0]).toContain('openrouter.ai');
    expect(interceptedTargetUrls[1]).toContain('generativelanguage.googleapis.com');
    expect(interceptedTargetUrls[2]).toContain('api.groq.com');
  });

  test('should inject Context Profile per step', async ({ page }) => {
    await page.click('#flowTabEdit');

    // Set different profiles for each step
    await page.selectOption('#step-profile-0', 'prof-1');
    await page.selectOption('#step-profile-1', 'prof-2');
    await page.selectOption('#step-profile-2', 'none');

    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Three Step Test Workflow")');

    const profileInjections = [];

    await page.route('**/api/ai/proxy**', async (route) => {
      const request = route.request();
      const body = request.postDataJSON?.() || {};
      const systemPrompt = body.messages?.find(m => m.role === 'system')?.content || '';
      profileInjections.push(systemPrompt);

      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Profile injection test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Verify profiles injected into system prompts
    expect(profileInjections[0]).toContain('Senior B2B Growth Copywriter');
    expect(profileInjections[1]).toContain('Principal Full-Stack Architect');
    expect(profileInjections[2]).not.toContain('[Active Persona Directives]');
  });

  test('should show progress percentage', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await new Promise(r => setTimeout(r, 200)); // Simulate realistic inference delay
      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Progress test');
    await page.click('#runFlowPipelineBtn');

    // Check progress bar exists and completes to 100%
    const progressFill = page.locator('#telemetryProgressFill');
    await expect(progressFill).toBeVisible();

    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });
    const finalWidth = await progressFill.evaluate(el => el.style.width);
    expect(finalWidth).toBe('100%');
  });

  test('should display active step', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await new Promise(r => setTimeout(r, 250));
      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Active step test');
    await page.click('#runFlowPipelineBtn');

    // During execution, running node is present
    await page.waitForTimeout(300);
    const runningNode = page.locator('.flow-step-node.running');
    await expect(runningNode).toBeVisible();

    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });
  });

  test('should show execution timer', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await new Promise(r => setTimeout(r, 150));
      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Timer test');
    await page.click('#runFlowPipelineBtn');

    // Timer starts running
    const timer = page.locator('#telemetryTimer');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Final timer shows formatted duration
    const finalTimer = await timer.textContent();
    expect(finalTimer).toMatch(/⏱ \d+:\d+\.\ds/);
  });

  test('should accumulate token usage', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 150, completion_tokens: 200, total_tokens: 350 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Token test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Token counter should show accumulated tokens (3 steps × 350 = 1,050)
    const tokenDisplay = page.locator('#telemetryTokens');
    await expect(tokenDisplay).toBeVisible();
    const tokenText = await tokenDisplay.textContent();
    expect(tokenText).toContain('1,050');
  });

  test('should generate consolidated output', async ({ page }) => {
    let callIdx = 0;
    const outputs = [
      '## Research Results\n\nComprehensive findings.',
      '## Technical Analysis\n\nDetailed specifications.',
      '## Critical Review\n\nReview with recommendations.'
    ];

    await page.route('**/api/ai/proxy**', async (route) => {
      const outputText = outputs[callIdx] || 'Additional Step';
      callIdx++;

      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: outputText, reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Consolidated output test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Click consolidated output tab (last tab in #flowResultTabs)
    await page.click('#flowResultTabs .comp-tab:last-child');

    const consolidatedOutput = page.locator('#flowActiveResultRendered');
    await expect(consolidatedOutput).toContainText('Research Results');
    await expect(consolidatedOutput).toContainText('Technical Analysis');
    await expect(consolidatedOutput).toContainText('Critical Review');
  });

  test('should verify only expected number of AI requests made', async ({ page }) => {
    let aiRequestCount = 0;
    const interceptedRequests = [];

    await page.route('**/api/ai/proxy**', async (route) => {
      aiRequestCount++;
      interceptedRequests.push(route.request().url());
      await route.fulfill({
        json: {
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response', reasoning: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        },
      });
    });

    await page.fill('#flowRootInput', 'Request count test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });

    // Exactly 3 requests made for 3 steps (no redundant or duplicate execution)
    expect(aiRequestCount).toBe(3);
    expect(interceptedRequests).toHaveLength(3);
  });

  test('should handle HTTP 429 rate limit error without silent mock fallback', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'retry-after': '0' },
        body: JSON.stringify({ error: { message: 'Rate limit exceeded. Please slow down.' } })
      });
    });

    await page.fill('#flowRootInput', 'Rate limit test');
    await page.click('#runFlowPipelineBtn');

    // Telemetry state must show FAILED
    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });

    // Error alert must be visible with message
    const errorAlert = page.locator('#telemetryErrorAlert');
    await expect(errorAlert).toBeVisible();
    await expect(page.locator('#telemetryErrorMessage')).toContainText('Rate limit exceeded');

    // First step node marked failed
    await expect(page.locator('#step-node-0')).toHaveClass(/failed/);
  });

  test('should handle HTTP 401 authentication error', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Invalid API key or unauthorized access.' } })
      });
    });

    await page.fill('#flowRootInput', 'Auth error test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });
    await expect(page.locator('#telemetryErrorAlert')).toBeVisible();
    await expect(page.locator('#telemetryErrorMessage')).toContainText('Invalid API key');
    await expect(page.locator('#step-node-0')).toHaveClass(/failed/);
  });

  test('should handle HTTP 500 provider server error', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Provider internal error: Model overloaded.' } })
      });
    });

    await page.fill('#flowRootInput', 'Server error test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });
    await expect(page.locator('#telemetryErrorAlert')).toBeVisible();
    await expect(page.locator('#telemetryErrorMessage')).toContainText('Model overloaded');
    await expect(page.locator('#step-node-0')).toHaveClass(/failed/);
  });

  test('should handle network transport failure', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await route.abort('failed');
    });

    await page.fill('#flowRootInput', 'Network failure test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });
    await expect(page.locator('#telemetryErrorAlert')).toBeVisible();
    await expect(page.locator('#step-node-0')).toHaveClass(/failed/);
  });

  test('should handle empty provider response', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [] })
      });
    });

    await page.fill('#flowRootInput', 'Empty response test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });
    await expect(page.locator('#telemetryErrorAlert')).toBeVisible();
    await expect(page.locator('#telemetryErrorMessage')).toContainText('empty completion');
    await expect(page.locator('#step-node-0')).toHaveClass(/failed/);
  });

  test('should handle malformed provider response', async ({ page }) => {
    await page.route('**/api/ai/proxy**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>502 Bad Gateway from Cloudflare</body></html>'
      });
    });

    await page.fill('#flowRootInput', 'Malformed response test');
    await page.click('#runFlowPipelineBtn');

    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });
    await expect(page.locator('#telemetryErrorAlert')).toBeVisible();
    await expect(page.locator('#step-node-0')).toHaveClass(/failed/);
  });
});
