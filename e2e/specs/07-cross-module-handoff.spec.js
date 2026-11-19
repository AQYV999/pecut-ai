/**
 * Pecut AI — Cross-Module Handoff E2E Tests
 * Suite 07: Tests data transfer between Flow, Canvas, Prompt Builder,
 * Library, Markdown/JSON Export, and Clipboard with strict security,
 * format preservation, and regression verification.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

/**
 * Selects a result tab in Pecut Flow by index (-1 for full consolidated output).
 */
async function selectResultTab(page, index) {
  const tabs = page.locator('#flowResultTabs .comp-tab');
  await expect(tabs.first()).toBeVisible({ timeout: 10000 });
  if (index === -1) {
    await tabs.last().click();
  } else {
    await tabs.nth(index).click();
  }
}

test.describe('Cross-Module Handoff', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard permissions for copy actions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

    // Seed deterministic BYOK config before navigation
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
        }
      }));
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await expect(page.locator('#view-flow.active')).toBeVisible();

    // Create a 2-step test workflow
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Handoff Test Workflow');
    await page.fill('#flowEditDesc', 'Workflow for cross-module handoff testing');

    // Step 0: Generate Prompt
    await page.fill('#step-title-0', 'Generate Prompt');
    await page.fill('#step-instruction-0', 'Create a prompt about: {{input}}');

    // Step 1: Refine Prompt
    await page.fill('#step-title-1', 'Refine Prompt');
    await page.fill('#step-instruction-1', 'Improve: {{prev}}');

    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    // Switch to Run mode
    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Handoff Test Workflow")');

    // Intercept provider proxy requests with deterministic mock responses
    await page.route('**/api/ai/proxy**', async (route) => {
      const request = route.request();
      const body = request.postDataJSON?.() || {};
      const messages = body.messages || [];
      const lastMsg = messages[messages.length - 1]?.content || '';

      let content = '';
      if (lastMsg.includes('Improve')) {
        content = `# Refined Prompt

## Optimized Architecture Plan
Enhanced specification with explicit caching and security policies.

### Key Refinements
1. Layer 7 rate limiting added.
2. Redis cluster for token replay protection.
3. End-to-end mTLS authentication.`;
      } else {
        content = `# Generated Prompt

## Role
Senior Cloud Architect

## Task
Design high-throughput event streaming architecture for {{input}}.

## Specifications
- Latency target: < 10ms
- Protocol: gRPC / Kafka
- Resilience: Multi-region failover`;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            index: 0,
            message: { role: 'assistant', content, reasoning: '' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 120, completion_tokens: 180, total_tokens: 300 },
        }),
      });
    });

    // Run the pipeline
    await page.fill('#flowRootInput', 'Real-time Payment Settlement');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });
  });

  // ==========================================
  // 1. CANVAS HANDOFF TESTS
  // ==========================================

  test('1.1 should send individual step output to Canvas and preserve markdown formatting', async ({ page }) => {
    // Select Step 1 tab (Generate Prompt)
    await selectResultTab(page, 0);

    // Handle overwrite confirmation dialog if starter workspace document is present
    page.once('dialog', async (d) => {
      await d.accept();
    });

    // Click Send to Canvas
    await page.click('#sendFlowToCanvasBtn');

    // Should navigate to Canvas view
    await expect(page.locator('#view-canvas.active')).toBeVisible({ timeout: 5000 });

    // Verify document content in editor
    const canvasEditor = page.locator('#canvasDocumentEditor');
    await expect(canvasEditor).toBeVisible();
    const content = await canvasEditor.inputValue();

    expect(content).toContain('Generated Prompt');
    expect(content).toContain('Senior Cloud Architect');
    expect(content).toContain('high-throughput event streaming');
    expect(content).not.toContain('Refined Prompt'); // Step 2 not sent
  });

  test('1.2 should send consolidated pipeline output to Canvas', async ({ page }) => {
    // Select Consolidated Tab
    await selectResultTab(page, -1);

    // Handle overwrite confirmation
    page.once('dialog', async (d) => {
      await d.accept();
    });

    // Click Send to Canvas
    await page.click('#sendFlowToCanvasBtn');

    // Should navigate to Canvas view
    await expect(page.locator('#view-canvas.active')).toBeVisible({ timeout: 5000 });

    const canvasEditor = page.locator('#canvasDocumentEditor');
    await expect(canvasEditor).toBeVisible();
    const content = await canvasEditor.inputValue();

    // Verify both steps are present in consolidated canvas output
    expect(content).toContain('Generated Prompt');
    expect(content).toContain('Refined Prompt');
    expect(content).toContain('Optimized Architecture Plan');
  });

  test('1.3 should append to existing Canvas content when overwrite confirmation is declined', async ({ page }) => {
    // First, populate canvas with existing content
    await page.click('.nav-item[data-nav="canvas"]');
    await expect(page.locator('#view-canvas.active')).toBeVisible();

    const existingText = 'Initial Canvas Draft Notes for Microservices.';
    await page.fill('#canvasDocumentEditor', existingText);
    await page.waitForTimeout(500); // Allow debounce save to persist to workspace storage

    // Navigate back to Flow
    await page.click('.nav-item[data-nav="flow"]');
    await expect(page.locator('#view-flow.active')).toBeVisible();

    // Select Step 1
    await selectResultTab(page, 0);

    // Listen for confirmation dialog and choose Cancel (dismiss -> append)
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Ganti seluruh isi Kanvas');
      await dialog.dismiss();
    });

    await page.click('#sendFlowToCanvasBtn');

    // Should navigate to Canvas
    await expect(page.locator('#view-canvas.active')).toBeVisible({ timeout: 5000 });

    const canvasEditor = page.locator('#canvasDocumentEditor');
    const content = await canvasEditor.inputValue();

    // Verify existing content is PRESERVED and new content is APPENDED
    expect(content).toContain(existingText);
    expect(content).toContain('---');
    expect(content).toContain('Generated Prompt');
  });

  test('1.4 should replace existing Canvas content when overwrite confirmation is accepted', async ({ page }) => {
    // Populate canvas with obsolete content
    await page.click('.nav-item[data-nav="canvas"]');
    await expect(page.locator('#view-canvas.active')).toBeVisible();

    const obsoleteText = 'Obsolete Draft That Must Be Replaced.';
    await page.fill('#canvasDocumentEditor', obsoleteText);
    await page.waitForTimeout(500); // Allow debounce save to persist

    // Navigate back to Flow
    await page.click('.nav-item[data-nav="flow"]');
    await expect(page.locator('#view-flow.active')).toBeVisible();

    // Select Step 2 (Refined Prompt)
    await selectResultTab(page, 1);

    // Listen for confirmation dialog and choose OK (accept -> replace)
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Ganti seluruh isi Kanvas');
      await dialog.accept();
    });

    await page.click('#sendFlowToCanvasBtn');

    // Should navigate to Canvas
    await expect(page.locator('#view-canvas.active')).toBeVisible({ timeout: 5000 });

    const canvasEditor = page.locator('#canvasDocumentEditor');
    const content = await canvasEditor.inputValue();

    // Verify obsolete content is GONE and replaced
    expect(content).not.toContain(obsoleteText);
    expect(content).toContain('Refined Prompt');
    expect(content).toContain('Optimized Architecture Plan');
  });

  test('1.5 should apply content directly without prompt when Canvas is initially empty', async ({ page }) => {
    // Clear Canvas document editor
    await page.click('.nav-item[data-nav="canvas"]');
    await page.fill('#canvasDocumentEditor', '');

    // Navigate back to Flow
    await page.click('.nav-item[data-nav="flow"]');

    // Fail if any dialog appears
    let dialogAppeared = false;
    const dialogHandler = () => { dialogAppeared = true; };
    page.on('dialog', dialogHandler);

    await selectResultTab(page, 0);
    await page.click('#sendFlowToCanvasBtn');

    await expect(page.locator('#view-canvas.active')).toBeVisible();
    const content = await page.locator('#canvasDocumentEditor').inputValue();
    expect(content.length).toBeGreaterThan(0);
    expect(dialogAppeared).toBe(false);

    page.off('dialog', dialogHandler);
  });

  // ==========================================
  // 2. PROMPT BUILDER HANDOFF TESTS
  // ==========================================

  test('2.1 should send active step output to Prompt Builder objective field', async ({ page }) => {
    // Select Step 1 tab
    await selectResultTab(page, 0);

    await page.click('#sendFlowToBuilderBtn');

    // Should navigate to Prompt Builder
    await expect(page.locator('#view-builder.active')).toBeVisible({ timeout: 5000 });

    const objectiveField = page.locator('#builderObjective');
    await expect(objectiveField).toBeVisible();
    const objectiveValue = await objectiveField.inputValue();

    expect(objectiveValue).toContain('Generated Prompt');
    expect(objectiveValue).toContain('Senior Cloud Architect');
  });

  test('2.2 should send consolidated output to Prompt Builder', async ({ page }) => {
    // Select Consolidated tab
    await selectResultTab(page, -1);

    await page.click('#sendFlowToBuilderBtn');

    await expect(page.locator('#view-builder.active')).toBeVisible({ timeout: 5000 });

    const objectiveValue = await page.locator('#builderObjective').inputValue();
    expect(objectiveValue).toContain('Generated Prompt');
    expect(objectiveValue).toContain('Refined Prompt');
  });

  test('2.3 should preserve unrelated user fields in Prompt Builder during handoff', async ({ page }) => {
    // Navigate to Prompt Builder and populate custom fields
    await page.click('.nav-item[data-nav="builder"]');
    await expect(page.locator('#view-builder.active')).toBeVisible();

    await page.fill('#builderRole', 'Principal Infrastructure Architect');
    await page.fill('#builderContext', 'Financial switch gateway processing 50k TPS');
    await page.fill('#builderInstructions', '1. Guarantee zero data loss\n2. Idempotent payment processing');

    // Navigate back to Flow and send output
    await page.click('.nav-item[data-nav="flow"]');
    await selectResultTab(page, 1);
    await page.click('#sendFlowToBuilderBtn');

    await expect(page.locator('#view-builder.active')).toBeVisible();

    // Verify unrelated fields are untouched
    await expect(page.locator('#builderRole')).toHaveValue('Principal Infrastructure Architect');
    await expect(page.locator('#builderContext')).toHaveValue('Financial switch gateway processing 50k TPS');
    await expect(page.locator('#builderInstructions')).toHaveValue('1. Guarantee zero data loss\n2. Idempotent payment processing');

    // Verify objective is updated with step 2 output
    const objVal = await page.locator('#builderObjective').inputValue();
    expect(objVal).toContain('Refined Prompt');
  });

  test('2.4 should handle multiline text and special characters in Builder handoff', async ({ page }) => {
    // Select consolidated output containing markdown and symbols
    await selectResultTab(page, -1);
    await page.click('#sendFlowToBuilderBtn');

    await expect(page.locator('#view-builder.active')).toBeVisible();
    const val = await page.locator('#builderObjective').inputValue();

    // Ensure brackets, hyphens, colons survived handoff intact
    expect(val).toContain('gRPC / Kafka');
    expect(val).toContain('< 10ms');
    expect(val).toContain('### Key Refinements');
  });

  // ==========================================
  // 3. PROMPT LIBRARY HANDOFF TESTS
  // ==========================================

  test('3.1 should save individual step output to Prompt Library with metadata', async ({ page }) => {
    // Select Step 1
    await selectResultTab(page, 0);

    await page.click('#saveFlowToLibBtn');
    await expect(page.locator('.toast:has-text("saved to Library")')).toBeVisible({ timeout: 5000 });

    // Navigate to Library
    await page.click('.nav-item[data-nav="library"]');
    await expect(page.locator('#view-library.active')).toBeVisible();

    // Verify prompt card exists in library
    const step1Card = page.locator('.prompt-card:has-text("Handoff Test Workflow - Step 1")');
    await expect(step1Card).toBeVisible({ timeout: 5000 });
    await expect(step1Card.locator('p')).toContainText('Senior Cloud Architect');
    await expect(step1Card.locator('.badge-cat')).toBeVisible();
  });

  test('3.2 should save consolidated output to Prompt Library', async ({ page }) => {
    // Select Consolidated tab
    await selectResultTab(page, -1);

    await page.click('#saveFlowToLibBtn');
    await expect(page.locator('.toast:has-text("saved to Library")')).toBeVisible({ timeout: 5000 });

    // Navigate to Library
    await page.click('.nav-item[data-nav="library"]');
    await expect(page.locator('#view-library.active')).toBeVisible();

    const fullCard = page.locator('.prompt-card:has-text("Handoff Test Workflow - Full Output")');
    await expect(fullCard).toBeVisible({ timeout: 5000 });
    await expect(fullCard.locator('p')).toContainText('Generated Prompt');
    await expect(fullCard.locator('p')).toContainText('Refined Prompt');
  });

  test('3.3 should persist saved library prompts after page reload', async ({ page }) => {
    // Save step 2 to library
    await selectResultTab(page, 1);
    await page.click('#saveFlowToLibBtn');
    await expect(page.locator('.toast:has-text("saved to Library")')).toBeVisible({ timeout: 5000 });

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Navigate to Library
    await page.click('.nav-item[data-nav="library"]');
    await expect(page.locator('#view-library.active')).toBeVisible();

    const step2Card = page.locator('.prompt-card:has-text("Handoff Test Workflow - Step 2")');
    await expect(step2Card).toBeVisible({ timeout: 5000 });
    await expect(step2Card.locator('p')).toContainText('Optimized Architecture Plan');
  });

  test('3.4 should support duplicate saves and individual deletion in Library', async ({ page }) => {
    // Save Step 1 twice
    await selectResultTab(page, 0);
    await page.click('#saveFlowToLibBtn');
    await expect(page.locator('.toast:has-text("saved to Library")').last()).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(200);
    await page.click('#saveFlowToLibBtn');
    await expect(page.locator('.toast:has-text("saved to Library")').last()).toBeVisible({ timeout: 5000 });

    // Navigate to Library
    await page.click('.nav-item[data-nav="library"]');
    await expect(page.locator('#view-library.active')).toBeVisible();

    const cards = page.locator('.prompt-card:has-text("Handoff Test Workflow - Step 1")');
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    // Delete one card
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('delete');
      await dialog.accept();
    });

    await cards.first().locator('button[data-action="delete"]').click();
    await page.waitForTimeout(500);

    const afterCount = await page.locator('.prompt-card:has-text("Handoff Test Workflow - Step 1")').count();
    expect(afterCount).toBe(initialCount - 1);
  });

  // ==========================================
  // 4. MARKDOWN & JSON EXPORT TESTS
  // ==========================================

  test('4.1 should download active output as a formatted Markdown (.md) file', async ({ page }) => {
    // Select Step 1
    await selectResultTab(page, 0);

    const downloadPromise = page.waitForEvent('download');
    await page.click('#downloadFlowResultBtn');
    const download = await downloadPromise;

    // Verify suggested filename
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.md$/);
    expect(filename.toLowerCase()).toContain('handoff-test-workflow');

    // Read download content
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString('utf-8');

    // Verify metadata header and content
    expect(content).toContain('# Handoff Test Workflow');
    expect(content).toContain('> **Step:** Generate Prompt');
    expect(content).toContain('> **Workflow ID:**');
    expect(content).toContain('Generated Prompt');
    expect(content).toContain('Senior Cloud Architect');
  });

  test('4.2 should export workflows as valid JSON without sensitive credentials', async ({ page }) => {
    // Switch to workflow builder edit tab
    await page.click('#flowTabEdit');

    const downloadPromise = page.waitForEvent('download');
    await page.click('#btnExportFlows');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.pecut-flow\.json$/);

    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const jsonStr = Buffer.concat(chunks).toString('utf-8');
    const parsed = JSON.parse(jsonStr);

    // Validate schema
    expect(parsed).toHaveProperty('schemaVersion');
    expect(parsed).toHaveProperty('exportedAt');
    expect(Array.isArray(parsed.flows)).toBe(true);

    const targetFlow = parsed.flows.find(f => f.title === 'Handoff Test Workflow');
    expect(targetFlow).toBeDefined();
    expect(targetFlow.steps.length).toBe(2);

    // Ensure NO credentials leaked in JSON export
    expect(jsonStr).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
    expect(jsonStr).not.toContain('test-key-mock-valid-12345');
    expect(jsonStr).not.toContain('Bearer ');
    expect(jsonStr).not.toContain('apiKey');
  });

  test('4.3 should confirm markdown download contains no credential leakage', async ({ page }) => {
    // Select Consolidated output
    await selectResultTab(page, -1);

    const downloadPromise = page.waitForEvent('download');
    await page.click('#downloadFlowResultBtn');
    const download = await downloadPromise;

    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString('utf-8');

    expect(content).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
    expect(content).not.toContain('test-key-mock-valid-12345');
    expect(content).not.toContain('Bearer ');
    expect(content).not.toContain('apiKey');
    expect(content).not.toContain('authorization');
  });

  // ==========================================
  // 5. CLIPBOARD INTEGRATION TESTS
  // ==========================================

  test('5.1 should copy individual step output to clipboard', async ({ page }) => {
    // Select Step 1
    await selectResultTab(page, 0);

    await page.click('#copyFlowResultBtn');
    await expect(page.locator('.toast:has-text("copied to clipboard")')).toBeVisible({ timeout: 5000 });

    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });

    expect(clipboardText).toContain('Generated Prompt');
    expect(clipboardText).toContain('Senior Cloud Architect');
    expect(clipboardText).not.toContain('Refined Prompt');
  });

  test('5.2 should copy consolidated output to clipboard', async ({ page }) => {
    // Select Consolidated tab
    await selectResultTab(page, -1);

    await page.click('#copyFlowResultBtn');
    await expect(page.locator('.toast:has-text("copied to clipboard")')).toBeVisible({ timeout: 5000 });

    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });

    expect(clipboardText).toContain('Generated Prompt');
    expect(clipboardText).toContain('Refined Prompt');
  });

  test('5.3 should gracefully handle clipboard errors when writeText is denied or unavailable', async ({ page }) => {
    // Mock navigator.clipboard.writeText failure
    await page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.reject(new Error('Clipboard write access denied by permission policy'));
    });

    await page.click('#copyFlowResultBtn');

    // Should display graceful error toast and not crash the UI
    await expect(page.locator('.toast:has-text("Unable to copy")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#view-flow.active')).toBeVisible();
  });

  // ==========================================
  // 6. DATA INTEGRITY & SECURITY TESTS
  // ==========================================

  test('6.1 should verify handoff actions do not trigger additional AI network requests', async ({ page }) => {
    let aiRequestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/ai/')) {
        aiRequestCount++;
      }
    });

    // Perform all handoff actions sequentially
    await selectResultTab(page, 0);
    await page.click('#copyFlowResultBtn');

    const downloadPromise = page.waitForEvent('download');
    await page.click('#downloadFlowResultBtn');
    await downloadPromise;

    await page.click('#saveFlowToLibBtn');

    // Navigate away and back
    await page.click('#sendFlowToCanvasBtn');
    await page.click('.nav-item[data-nav="flow"]');

    await page.click('#sendFlowToBuilderBtn');
    await page.click('.nav-item[data-nav="flow"]');

    // Assert zero new AI network requests were triggered by handoff operations
    expect(aiRequestCount).toBe(0);
  });

  test('6.2 should verify source flow outputs remain intact and unmodified after handoff', async ({ page }) => {
    // Capture original output values
    const originalRaw = await page.locator('#flowActiveResultOutput').innerText();
    const originalRendered = await page.locator('#flowActiveResultRendered').innerHTML();

    // Perform handoffs
    await page.click('#sendFlowToCanvasBtn');
    await page.click('.nav-item[data-nav="flow"]');

    await page.click('#sendFlowToBuilderBtn');
    await page.click('.nav-item[data-nav="flow"]');

    await page.click('#saveFlowToLibBtn');
    await page.click('#copyFlowResultBtn');

    // Verify source outputs are completely intact
    const currentRaw = await page.locator('#flowActiveResultOutput').innerText();
    const currentRendered = await page.locator('#flowActiveResultRendered').innerHTML();

    expect(currentRaw).toBe(originalRaw);
    expect(currentRendered).toBe(originalRendered);
  });
});
