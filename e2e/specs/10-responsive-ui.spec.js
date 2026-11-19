/**
 * Pecut AI — Responsive UI & Cross-Browser Stability E2E Tests
 * Suite 10: Multi-viewport validation across Desktop, Laptop, Tablet, and Mobile.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

const viewports = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 390, height: 844 },
];

/**
 * Robust helper to navigate to any app view across responsive viewports.
 * On Tablet/Mobile (viewport width <= 1024), it toggles the sidebar open first if needed.
 */
async function navigateToView(page, viewName) {
  const activeSection = page.locator(`#view-${viewName}.active`);
  if (await activeSection.isVisible().catch(() => false)) {
    return;
  }

  const mobileToggle = page.locator('#mobileToggle');
  if (await mobileToggle.isVisible().catch(() => false)) {
    const sidebar = page.locator('#sidebar');
    const isOpen = await sidebar.evaluate(el => el.classList.contains('open')).catch(() => false);
    if (!isOpen) {
      await mobileToggle.click();
      await expect(sidebar).toHaveClass(/open/);
    }
  }

  const navItem = page.locator(`.nav-item[data-nav="${viewName}"]`);
  await expect(navItem).toBeVisible();
  await navItem.click();
  await expect(page.locator(`#view-${viewName}.active`)).toBeVisible({ timeout: 5000 });
}

test.describe('Suite 10: Responsive UI & Cross-Browser Stability', () => {
  for (const viewport of viewports) {
    test.describe(`${viewport.name} (${viewport.width}×${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        // Seed BYOK credentials and profiles deterministically before load
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
              model: 'gemini-2.0-flash',
              baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
            }
          }));
        });

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/', { waitUntil: 'networkidle' });
      });

      test('should render navigation and sidebar correctly', async ({ page }) => {
        const sidebar = page.locator('#sidebar');

        if (viewport.width <= 1024) {
          // Mobile & Tablet: sidebar is off-screen by default, mobile toggle is visible
          const mobileToggle = page.locator('#mobileToggle');
          await expect(mobileToggle).toBeVisible();
          await expect(sidebar).not.toHaveClass(/open/);

          // Open sidebar via hamburger toggle
          await mobileToggle.click();
          await expect(sidebar).toHaveClass(/open/);

          // Close sidebar via close button
          const closeBtn = page.locator('#mobileCloseBtn');
          await expect(closeBtn).toBeVisible();
          await closeBtn.click();
          await expect(sidebar).not.toHaveClass(/open/);
        } else {
          // Desktop & Laptop: sidebar is permanently visible, toggle is hidden
          await expect(sidebar).toBeVisible();
          await expect(page.locator('#mobileToggle')).toBeHidden();
        }
      });

      test('should have usable workflow builder layout and step editor', async ({ page }) => {
        await navigateToView(page, 'flow');

        // Switch to Builder/Edit mode
        await page.locator('#flowTabEdit').click();
        await expect(page.locator('#flowBuilderView')).toBeVisible();

        await page.locator('#btnCreateFlow').click();

        // Step editor cards should be visible and usable
        const stepCards = page.locator('.flow-step-edit-card');
        await expect(stepCards.first()).toBeVisible();

        // Form inputs should be accessible
        const titleInput = page.locator('#flowEditTitle');
        await expect(titleInput).toBeVisible();
        await titleInput.fill(`Responsive Flow ${viewport.name}`);

        const stepTitleInput = page.locator('#step-title-0');
        await expect(stepTitleInput).toBeVisible();
        await stepTitleInput.fill('Step 1 Title');

        const stepInst = page.locator('#step-instruction-0');
        await expect(stepInst).toBeVisible();
        await stepInst.fill('Process {{input}}');

        // Provider and model selectors
        await expect(page.locator('#step-provider-0')).toBeVisible();
        await expect(page.locator('#step-model-0')).toBeVisible();
        await expect(page.locator('#step-profile-0')).toBeVisible();

        // Variable chips should be clickable
        const varChips = page.locator('.var-chip');
        await expect(varChips.first()).toBeVisible();
        await varChips.first().click();

        // Verify chip inserted variable tag
        const instructionVal = await stepInst.inputValue();
        expect(instructionVal.length).toBeGreaterThan(0);
      });

      test('should display step cards properly in run view', async ({ page }) => {
        await navigateToView(page, 'flow');
        await page.locator('#flowTabRun').click();

        // Select first workflow card
        const pickerCard = page.locator('.flow-picker-card').first();
        await expect(pickerCard).toBeVisible();
        await pickerCard.click();

        // Step visualizer nodes should render
        const stepNodes = page.locator('.flow-step-node');
        await expect(stepNodes.first()).toBeVisible();

        // Step content should be readable
        const firstStep = stepNodes.first();
        await expect(firstStep.locator('h5')).toBeVisible();
        await expect(firstStep.locator('p')).toBeVisible();

        // Verify step card does not bleed horizontally
        const box = await firstStep.boundingBox();
        expect(box).not.toBeNull();
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 5);
      });

      test('should have functional provider selectors and parameters', async ({ page }) => {
        await navigateToView(page, 'flow');
        await page.locator('#flowTabEdit').click();
        await page.locator('#btnCreateFlow').click();

        // Test provider dropdown
        const provSelect = page.locator('#step-provider-0');
        await provSelect.selectOption('gemini');
        await expect(provSelect).toHaveValue('gemini');

        // Model selector should reflect gemini models
        const modelSelect = page.locator('#step-model-0');
        await expect(modelSelect).toBeVisible();
        await modelSelect.selectOption('inherit');
        await expect(modelSelect).toHaveValue('inherit');

        // Test profile dropdown
        const profSelect = page.locator('#step-profile-0');
        await profSelect.selectOption('none');
        await expect(profSelect).toHaveValue('none');

        // Advanced parameters toggle
        const advToggle = page.locator('.flow-step-edit-card [data-action="toggle-advanced"]').first();
        if (await advToggle.isVisible()) {
          await advToggle.click();
          await expect(page.locator('#step-temp-0')).toBeVisible();
          await expect(page.locator('#step-tokens-0')).toBeVisible();
        }
      });

      test('should display telemetry panel correctly during execution', async ({ page }) => {
        await navigateToView(page, 'flow');
        await page.locator('#flowTabRun').click();
        await page.locator('.flow-picker-card').first().click();

        // Mock AI proxy endpoint
        await page.route('**/api/ai/proxy**', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            json: {
              choices: [{ index: 0, message: { role: 'assistant', content: 'Step completed successfully.', reasoning: '' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
            },
          });
        });

        await page.locator('#flowRootInput').fill('Telemetry responsiveness test');
        await page.locator('#runFlowPipelineBtn').click();

        // Telemetry panel should be visible
        const telemetryPanel = page.locator('#flowTelemetryPanel');
        await expect(telemetryPanel).toBeVisible({ timeout: 5000 });

        // Telemetry indicators
        await expect(page.locator('#telemetryStateBadge')).toBeVisible();
        await expect(page.locator('#telemetryProgressLabel')).toBeVisible();
        await expect(page.locator('#telemetryTimer')).toBeVisible();
        await expect(page.locator('#telemetryProgressFill')).toBeVisible();
      });

      test('should display output viewer and action controls correctly', async ({ page }) => {
        await navigateToView(page, 'flow');
        await page.locator('#flowTabRun').click();
        await page.locator('.flow-picker-card').first().click();

        await page.route('**/api/ai/proxy**', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            json: {
              choices: [{ index: 0, message: { role: 'assistant', content: '# Step Summary\n\n- Point 1\n- Point 2', reasoning: '' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 },
            },
          });
        });

        await page.locator('#flowRootInput').fill('Output viewer test');
        await page.locator('#runFlowPipelineBtn').click();
        await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

        // Results container should be visible
        await expect(page.locator('#flowResultsContainer')).toBeVisible();

        // Tabs
        const tabs = page.locator('#flowResultTabs .comp-tab');
        await expect(tabs.first()).toBeVisible();

        // Mode toggles
        await expect(page.locator('#btnModeMarkdown')).toBeVisible();
        await expect(page.locator('#btnModeRaw')).toBeVisible();

        // Action buttons
        await expect(page.locator('#copyFlowResultBtn')).toBeVisible();
        await expect(page.locator('#downloadFlowResultBtn')).toBeVisible();
        await expect(page.locator('#sendFlowToCanvasBtn')).toBeVisible();
        await expect(page.locator('#sendFlowToBuilderBtn')).toBeVisible();
        await expect(page.locator('#saveFlowToLibBtn')).toBeVisible();
      });

      test('should have functional modal behavior', async ({ page }) => {
        const badge = page.locator('#apiStatusBadge');
        await expect(badge).toBeVisible();
        await badge.click();

        const modal = page.locator('#aiConnectionModal');
        await expect(modal).toHaveClass(/active/, { timeout: 3000 });
        await expect(page.locator('#byokProviderSelect')).toBeVisible();

        // Close modal via close button
        await page.locator('#closeAIModalBtn').click();
        await expect(modal).not.toHaveClass(/active/, { timeout: 3000 });
      });

      test('should not have critical horizontal overflow', async ({ page }) => {
        // 1. Check Overview view
        let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 10);

        // 2. Check Flow Builder Run view
        await navigateToView(page, 'flow');
        scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 10);

        // 3. Check Flow Builder Edit view
        await page.locator('#flowTabEdit').click();
        scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 10);
      });

      test('should not clip primary actions and remain interactable', async ({ page }) => {
        await navigateToView(page, 'flow');
        await page.locator('#flowTabRun').click();
        await page.locator('.flow-picker-card').first().click();

        const runButton = page.locator('#runFlowPipelineBtn');
        await runButton.scrollIntoViewIfNeeded();
        await expect(runButton).toBeVisible();
        await expect(runButton).toBeEnabled();

        const buttonBox = await runButton.boundingBox();
        expect(buttonBox).not.toBeNull();
        expect(buttonBox.x).toBeGreaterThanOrEqual(0);
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(viewport.width + 5);

        // Check edit mode primary actions
        await page.locator('#flowTabEdit').click();
        const createBtn = page.locator('#btnCreateFlow');
        await createBtn.scrollIntoViewIfNeeded();
        await expect(createBtn).toBeVisible();
        await expect(createBtn).toBeEnabled();
        const createBox = await createBtn.boundingBox();
        expect(createBox).not.toBeNull();
        expect(createBox.x + createBox.width).toBeLessThanOrEqual(viewport.width + 5);
      });

      test('should capture screenshot for visual verification', async ({ page }) => {
        await navigateToView(page, 'flow');
        await page.waitForTimeout(300);

        await page.screenshot({
          path: `e2e/screenshots/responsive-${viewport.name.toLowerCase()}-flow.png`,
          fullPage: true,
        });
      });
    });
  }

  test.describe('Cross-viewport navigation & state persistence', () => {
    test('should maintain state when resizing across viewports', async ({ page }) => {
      // Start at desktop
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });

      await navigateToView(page, 'flow');
      await page.locator('#flowTabEdit').click();
      await page.locator('#btnCreateFlow').click();

      await page.locator('#flowEditTitle').fill('Cross Viewport Resize Test');

      // Resize to mobile
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);

      // Title should persist across resize
      await expect(page.locator('#flowEditTitle')).toHaveValue('Cross Viewport Resize Test');

      // Resize back to desktop
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(300);

      await expect(page.locator('#flowEditTitle')).toHaveValue('Cross Viewport Resize Test');
    });
  });
});
