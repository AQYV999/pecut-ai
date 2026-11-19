/**
 * Pecut AI — Workflow Builder E2E Tests
 * Tests the complete workflow management experience.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

test.describe('Workflow Builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await expect(page.locator('#view-flow.active')).toBeVisible();
  });

  test('should open Pecut Flow and show workflow list', async ({ page }) => {
    // Verify flow view loads
    await expect(page.locator('.flow-layout')).toBeVisible();
    await expect(page.locator('.flow-sidebar-pane')).toBeVisible();
    await expect(page.locator('.flow-main-pane')).toBeVisible();

    // Verify workflow selector list
    await expect(page.locator('#flowSelectorList')).toBeVisible();

    // Should have at least the default workflows
    const flowCards = page.locator('.flow-picker-card');
    expect(await flowCards.count()).toBeGreaterThan(0);
  });

  test('should switch between Run Pipeline and Workflow Builder modes', async ({ page }) => {
    // Default should be Run mode
    await expect(page.locator('#flowTabRun')).toHaveClass(/active/);
    await expect(page.locator('#flowRunView')).toBeVisible();
    await expect(page.locator('#flowBuilderView')).toBeHidden();

    // Switch to Edit mode
    await page.click('#flowTabEdit');
    await expect(page.locator('#flowTabEdit')).toHaveClass(/active/);
    await expect(page.locator('#flowBuilderView')).toBeVisible();
    await expect(page.locator('#flowRunView')).toBeHidden();

    // Switch back to Run mode
    await page.click('#flowTabRun');
    await expect(page.locator('#flowTabRun')).toHaveClass(/active/);
    await expect(page.locator('#flowRunView')).toBeVisible();
  });

  test('should create a new workflow', async ({ page }) => {
    await page.click('#flowTabEdit');

    // Click New Workflow button
    await page.click('#btnCreateFlow');

    // Should be in edit mode with new workflow
    await expect(page.locator('#flowEditTitle')).toBeVisible();
    await expect(page.locator('#flowStepsEditor')).toBeVisible();

    // Verify default steps exist (2 steps)
    const stepCards = page.locator('.flow-step-edit-card');
    await expect(stepCards).toHaveCount(2);
  });

  test('should edit workflow title and description', async ({ page }) => {
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');

    // Edit title
    await page.fill('#flowEditTitle', 'E2E Test Workflow');
    await expect(page.locator('#flowEditTitle')).toHaveValue('E2E Test Workflow');

    // Edit description
    await page.fill('#flowEditDesc', 'Test workflow for E2E verification');
    await expect(page.locator('#flowEditDesc')).toHaveValue('Test workflow for E2E verification');

    // Edit category
    await page.selectOption('#flowEditCategory', 'Engineering');
    await expect(page.locator('#flowEditCategory')).toHaveValue('Engineering');
  });

  test('should add multiple steps', async ({ page }) => {
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');

    // Should start with 2 steps
    let stepCards = page.locator('.flow-step-edit-card');
    await expect(stepCards).toHaveCount(2);

    // Add a step
    await page.click('#btnAddStepBtn');
    await page.waitForTimeout(500);
    stepCards = page.locator('.flow-step-edit-card');
    await expect(stepCards).toHaveCount(3);

    // Add another step
    await page.click('#btnAddStepBtn');
    await page.waitForTimeout(500);
    stepCards = page.locator('.flow-step-edit-card');
    await expect(stepCards).toHaveCount(4);
  });

  test('should edit step title and instructions', async ({ page }) => {
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');

    // Edit first step title
    await page.fill('#step-title-0', 'Research Phase');
    await expect(page.locator('#step-title-0')).toHaveValue('Research Phase');

    // Edit first step instruction
    const instruction = 'Research the topic thoroughly:\n{{input}}\n\nProvide comprehensive findings.';
    await page.fill('#step-instruction-0', instruction);
    await expect(page.locator('#step-instruction-0')).toHaveValue(instruction);

    // Edit second step
    await page.fill('#step-title-1', 'Analysis Phase');
    await page.fill('#step-instruction-1', 'Analyze findings:\n{{prev}}\n\nCreate technical specification.');
  });

  test('should duplicate a step', async ({ page }) => {
    console.log('Starting duplicate step test...');
    await page.click('#flowTabEdit');
    console.log('Clicked flowTabEdit');
    await page.click('#btnCreateFlow');
    console.log('Clicked btnCreateFlow');

    // Wait for step editor to be visible
    await expect(page.locator('#flowStepsEditor')).toBeVisible({ timeout: 10000 });
    console.log('flowStepsEditor visible');
    await expect(page.locator('.flow-step-edit-card').first()).toBeVisible({ timeout: 10000 });
    console.log('First step card visible');

    const initialCount = await page.locator('.flow-step-edit-card').count();
    console.log('Initial count:', initialCount);

    // Click duplicate on first step
    await page.click('.flow-step-edit-card:first-child .btn-icon[title="Duplicate Step"]');
    console.log('Clicked duplicate button');
    await page.waitForTimeout(500);

    const newCount = await page.locator('.flow-step-edit-card').count();
    console.log('New count:', newCount);
    expect(newCount).toBe(initialCount + 1);

    // Verify duplicated step (inserted at index 1 immediately following first step) has "(Copy)" in title
    const duplicatedStepTitle = page.locator('.flow-step-edit-card:nth-child(2) input[id^="step-title-"]');
    await expect(duplicatedStepTitle).toHaveValue(/Copy/, { timeout: 10000 });
    console.log('Test passed');
  });

  test('should delete a step', async ({ page }) => {
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');

    // Add a step first so we have 3
    await page.click('#btnAddStepBtn');
    await page.waitForTimeout(500);
    let stepCards = page.locator('.flow-step-edit-card');
    await expect(stepCards).toHaveCount(3);

    // Delete the middle step (index 1)
    await page.click('.flow-step-edit-card:nth-child(2) .btn-icon[title="Delete Step"]');
    await page.waitForTimeout(500);

    stepCards = page.locator('.flow-step-edit-card');
    await expect(stepCards).toHaveCount(2);
  });

  test('should move steps up and down', async ({ page }) => {
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');

    // Add a third step
    await page.click('#btnAddStepBtn');
    await page.waitForTimeout(500);

    // Get initial titles
    const title0Before = await page.locator('#step-title-0').inputValue();
    const title1Before = await page.locator('#step-title-1').inputValue();
    const title2Before = await page.locator('#step-title-2').inputValue();

    // Move step 2 (index 1) down
    await page.click('.flow-step-edit-card:nth-child(2) .step-reorder-btn[title="Move Step Down"]');
    await page.waitForTimeout(500);

    // Verify order changed
    const title0After = await page.locator('#step-title-0').inputValue();
    const title1After = await page.locator('#step-title-1').inputValue();
    const title2After = await page.locator('#step-title-2').inputValue();

    expect(title0After).toBe(title0Before);
    expect(title1After).toBe(title2Before); // Step 2 moved down
    expect(title2After).toBe(title1Before); // Step 3 moved up

    // Move it back up
    await page.click('.flow-step-edit-card:nth-child(3) .step-reorder-btn[title="Move Step Up"]');
    await page.waitForTimeout(500);

    const title0Final = await page.locator('#step-title-0').inputValue();
    const title1Final = await page.locator('#step-title-1').inputValue();
    const title2Final = await page.locator('#step-title-2').inputValue();

    expect(title1Final).toBe(title1Before);
    expect(title2Final).toBe(title2Before);
  });

  test('should insert variables through Variable Chips', async ({ page }) => {
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');

    // Focus on second step instruction (should have {{prev}} and {{step1}} available)
    await page.click('#step-instruction-1');

    // Click {{prev}} chip
    await page.locator('#step-edit-card-1 .var-chip').filter({ hasText: '{{prev}}' }).click();

    // Click {{step1}} chip
    await page.locator('#step-edit-card-1 .var-chip').filter({ hasText: '{{step1}}' }).click();

    // Click stable ID chip if available
    await page.locator('#step-edit-card-1 .var-chip').filter({ hasText: '{{step:' }).click();

    // Verify variables were inserted
    const instruction = await page.locator('#step-instruction-1').inputValue();
    expect(instruction).toContain('{{prev}}');
    expect(instruction).toContain('{{step1}}');
  });

  test('should save the workflow', async ({ page }) => {
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');

    // Fill in workflow details
    await page.fill('#flowEditTitle', 'Persisted Test Workflow');
    await page.fill('#flowEditDesc', 'Testing persistence');
    await page.selectOption('#flowEditCategory', 'Productivity');

    // Modify a step
    await page.fill('#step-title-0', 'Custom Step 1');
    await page.fill('#step-instruction-0', 'Process: {{input}}');

    // Save
    await page.click('#btnSaveFlow');

    // Verify toast notification
    await expect(page.locator('.toast:has-text("saved")')).toBeVisible({ timeout: 5000 });

    // Verify workflow appears in list
    await page.click('#flowTabRun');
    const flowCards = page.locator('.flow-picker-card');
    await expect(flowCards.filter({ hasText: 'Persisted Test Workflow' })).toBeVisible();
  });

  test('should persist workflow after browser reload', async ({ page }) => {
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');

    await page.fill('#flowEditTitle', 'Reload Persistence Test');
    await page.fill('#flowEditDesc', 'Verifying reload persistence');
    await page.fill('#step-title-0', 'Step A');
    await page.fill('#step-instruction-0', 'Input: {{input}}');
    await page.fill('#step-title-1', 'Step B');
    await page.fill('#step-instruction-1', 'Previous: {{prev}}');

    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")')).toBeVisible({ timeout: 5000 });

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await expect(page.locator('#view-flow.active')).toBeVisible();

    // Verify workflow still exists
    await expect(page.locator('.flow-picker-card:has-text("Reload Persistence Test")')).toBeVisible();

    // Select it and verify content
    await page.click('.flow-picker-card:has-text("Reload Persistence Test")');
    await page.click('#flowTabEdit');

    await expect(page.locator('#flowEditTitle')).toHaveValue('Reload Persistence Test');
    await expect(page.locator('#step-title-0')).toHaveValue('Step A');
    await expect(page.locator('#step-title-1')).toHaveValue('Step B');
  });

  test('should search for a workflow', async ({ page }) => {
    // First create a uniquely named workflow
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Unique Searchable Workflow XYZ123');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")')).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');

    // Search for it
    await page.fill('#flowSearchInput', 'XYZ123');
    await page.waitForTimeout(300);

    const results = page.locator('.flow-picker-card');
    await expect(results).toHaveCount(1);
    await expect(results.first()).toContainText('Unique Searchable Workflow XYZ123');

    // Clear search
    await page.fill('#flowSearchInput', '');
    await page.waitForTimeout(300);
    expect(await results.count()).toBeGreaterThan(1);
  });

  test('should duplicate a workflow', async ({ page }) => {
    // Create a workflow first
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Workflow To Duplicate');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")')).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');

    // Click duplicate button on the workflow card
    await page.click('.flow-picker-card:has-text("Workflow To Duplicate") .btn-icon[title="Duplicate workflow"]');
    await page.waitForTimeout(500);

    // Should have duplicated workflow
    const cards = page.locator('.flow-picker-card:has-text("Workflow To Duplicate")');
    await expect(cards).toHaveCount(2);
  });

  test('should delete a workflow', async ({ page }) => {
    // Create a workflow to delete
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Workflow To Delete');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")')).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');

    // Click delete button
    page.on('dialog', dialog => dialog.accept());
    await page.click('.flow-picker-card:has-text("Workflow To Delete") .btn-icon[title="Delete workflow"]');
    await page.waitForTimeout(500);

    // Should be gone
    await expect(page.locator('.flow-picker-card:has-text("Workflow To Delete")')).toHaveCount(0);
  });

  test('should export and import workflow JSON', async ({ page }) => {
    // Create a workflow
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Export Import Test');
    await page.fill('#step-title-0', 'Export Step');
    await page.fill('#step-instruction-0', 'Test: {{input}}');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")')).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');

    // Export - intercept download
    const downloadPromise = page.waitForEvent('download');
    await page.click('#btnExportFlows');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/pecut-flows-.*\.pecut-flow\.json/);

    // Read the exported file
    const exportedContent = await download.createReadStream();
    // Note: In real test, we'd parse the JSON and verify structure

    // Import - create a new workflow first to have something to import over
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Temp For Import');
    await page.click('#btnSaveFlow');

    // Trigger import file input
    const fileInput = page.locator('#flowFileInput');
    await fileInput.setInputFiles({
      name: 'test-import.pecut-flow.json',
      mimeType: 'application/json',
      buffer: Buffer.from(await download.createReadStream().then(s => {
        const chunks = [];
        return new Promise(resolve => {
          s.on('data', c => chunks.push(c));
          s.on('end', () => resolve(Buffer.concat(chunks)));
        });
      })),
    });

    await page.waitForTimeout(1000);

    // Verify import succeeded
    await expect(page.locator('.toast:has-text("imported")')).toBeVisible({ timeout: 5000 });
  });

  test('should not lose user data during operations', async ({ page }) => {
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');

    // Create a complex workflow
    await page.fill('#flowEditTitle', 'Data Integrity Test');
    await page.fill('#step-title-0', 'Step 1');
    await page.fill('#step-instruction-0', 'Process {{input}} with {{var1}}');
    await page.fill('#step-title-1', 'Step 2');
    await page.fill('#step-instruction-1', 'Analyze {{prev}} and {{step1}}');
    await page.click('#btnAddStepBtn');
    await page.waitForTimeout(500);
    await page.fill('#step-title-2', 'Step 3');
    await page.fill('#step-instruction-2', 'Review {{step1}} and {{step2}}');

    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    // Perform various operations
    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Data Integrity Test")');
    await page.click('#flowTabEdit');

    // Duplicate a step
    await page.click('.flow-step-edit-card:first-child .btn-icon[title="Duplicate Step"]');
    await page.waitForTimeout(500);

    // Move a step
    await page.click('.flow-step-edit-card:nth-child(3) .step-reorder-btn[title="Move Step Up"]');
    await page.waitForTimeout(500);

    // Save again
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    // Reload and verify all data intact
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await page.click('.flow-picker-card:has-text("Data Integrity Test")');
    await page.click('#flowTabEdit');

    const steps = page.locator('.flow-step-edit-card');
    await expect(steps).toHaveCount(4); // Original 3 + 1 duplicated

    // Verify content preserved
    await expect(page.locator('#step-title-0')).toHaveValue('Step 1');
    await expect(page.locator('#step-instruction-0')).toHaveValue(/\{\{input\}\}/);
  });
});