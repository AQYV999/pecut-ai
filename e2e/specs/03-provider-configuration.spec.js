/**
 * Pecut AI — Provider & Context Configuration E2E Tests
 * Verifies BYOK inheritance, provider selection, model selection, and context profiles.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

test.describe('Provider & Context Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await expect(page.locator('#view-flow.active')).toBeVisible();
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
  });

  test('should show active BYOK inheritance by default', async ({ page }) => {
    // Default provider should be "inherit"
    await expect(page.locator('#step-provider-0')).toHaveValue('inherit');
    await expect(page.locator('#step-model-0')).toHaveValue('inherit');

    // Verify options show inheritance labels
    await expect(page.locator('#step-provider-0 option[value="inherit"]')).toContainText('Inherit BYOK');
    await expect(page.locator('#step-model-0 option[value="inherit"]')).toContainText('Inherit Active Model');
    await expect(page.locator('#step-profile-0 option[value="inherit"]')).toContainText('Inherit Workflow');
  });

  test('should allow explicit provider selection', async ({ page }) => {
    // Change provider to OpenRouter
    await page.selectOption('#step-provider-0', 'openrouter');
    await expect(page.locator('#step-provider-0')).toHaveValue('openrouter');

    // Model should update to provider default
    await expect(page.locator('#step-model-0')).toHaveValue('meta-llama/llama-3.3-70b-instruct:free');
  });

  test('should allow explicit model selection per provider', async ({ page }) => {
    await page.selectOption('#step-provider-0', 'gemini');
    await page.waitForTimeout(300);

    // Get available models for Gemini
    const modelOptions = await page.locator('#step-model-0 option').allTextContents();
    expect(modelOptions.some(opt => opt.toLowerCase().includes('gemini'))).toBeTruthy();

    // Select a specific model
    const geminiOption = page.locator('#step-model-0 option[value="gemini-3.8-flash"]');
    await expect(geminiOption).toBeAttached();
    await page.selectOption('#step-model-0', 'gemini-3.8-flash');
    await expect(page.locator('#step-model-0')).toHaveValue('gemini-3.8-flash');
  });

  test('should allow custom model input', async ({ page }) => {
    await page.selectOption('#step-provider-0', 'custom');
    await page.waitForTimeout(300);

    // Custom model dropdown should be visible and populated
    const modelSelect = page.locator('#step-model-0');
    await expect(modelSelect).toBeVisible();
    const options = await modelSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(1);
  });

  test('should switch providers without losing prompts', async ({ page }) => {
    // Set initial instruction
    const originalInstruction = 'Analyze this input: {{input}} with custom logic';
    await page.fill('#step-instruction-0', originalInstruction);

    // Switch provider
    await page.selectOption('#step-provider-0', 'groq');
    await page.waitForTimeout(300);

    // Instruction should be preserved
    await expect(page.locator('#step-instruction-0')).toHaveValue(originalInstruction);

    // Switch to another provider
    await page.selectOption('#step-provider-0', 'openai');
    await page.waitForTimeout(300);

    // Instruction should still be preserved
    await expect(page.locator('#step-instruction-0')).toHaveValue(originalInstruction);
  });

  test('should configure Context Profile inheritance', async ({ page }) => {
    // Default should be inherit
    await expect(page.locator('#step-profile-0')).toHaveValue('inherit');

    // Select a specific profile (prof-2: Senior TypeScript Architect)
    await page.selectOption('#step-profile-0', 'prof-2');
    await expect(page.locator('#step-profile-0')).toHaveValue('prof-2');

    // Verify profile name appears in option
    const profileOption = page.locator('#step-profile-0 option[value="prof-2"]');
    await expect(profileOption).toContainText('Senior TypeScript Architect');
  });

  test('should support Context Profile "none" mode', async ({ page }) => {
    await page.selectOption('#step-profile-0', 'none');
    await expect(page.locator('#step-profile-0')).toHaveValue('none');

    const noneOption = page.locator('#step-profile-0 option[value="none"]');
    await expect(noneOption).toContainText('None (No Directives)');
  });

  test('should support specific Context Profile selection', async ({ page }) => {
    const profiles = ['prof-1', 'prof-2', 'prof-3'];

    for (const profileId of profiles) {
      await page.selectOption('#step-profile-0', profileId);
      await expect(page.locator('#step-profile-0')).toHaveValue(profileId);
    }
  });

  test('should configure Temperature', async ({ page }) => {
    // Open advanced panel on step 0
    const toggleBtn = page.locator('#step-edit-card-0 .flow-advanced-toggle-btn');
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Verify temperature input exists
    const tempInput = page.locator('#step-edit-card-0 input[oninput*="updateStepTemperature"]');
    await expect(tempInput).toBeVisible();

    // Set temperature
    await tempInput.fill('0.7');
    await expect(tempInput).toHaveValue('0.7');

    // Verify button updates
    await expect(toggleBtn).toContainText('Temp: 0.7');
  });

  test('should configure Max Tokens', async ({ page }) => {
    // Open advanced panel if not open
    const toggleBtn = page.locator('#step-edit-card-0 .flow-advanced-toggle-btn');
    const isOpen = await toggleBtn.evaluate(el => el.textContent.includes('▲'));
    if (!isOpen) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
    }

    // Verify max tokens input exists
    const tokensInput = page.locator('#step-edit-card-0 input[oninput*="updateStepMaxTokens"]');
    await expect(tokensInput).toBeVisible();

    // Set max tokens
    await tokensInput.fill('8192');
    await expect(tokensInput).toHaveValue('8192');

    // Verify button updates
    await expect(toggleBtn).toContainText('Max Tokens: 8192');
  });

  test('should validate Temperature bounds (0.0 - 2.0)', async ({ page }) => {
    const toggleBtn = page.locator('#step-edit-card-0 .flow-advanced-toggle-btn');
    await toggleBtn.click();
    await page.waitForTimeout(300);

    const tempInput = page.locator('#step-edit-card-0 input[oninput*="updateStepTemperature"]');

    // Test upper bound
    await tempInput.fill('2.5');
    await tempInput.blur();
    await page.waitForTimeout(100);
    const value = await tempInput.inputValue();
    expect(parseFloat(value)).toBeLessThanOrEqual(2.0);

    // Test lower bound
    await tempInput.fill('-0.5');
    await tempInput.blur();
    await page.waitForTimeout(100);
    const value2 = await tempInput.inputValue();
    expect(parseFloat(value2)).toBeGreaterThanOrEqual(0);
  });

  test('should validate Max Tokens bounds (256 - 65536)', async ({ page }) => {
    const toggleBtn = page.locator('#step-edit-card-0 .flow-advanced-toggle-btn');
    await toggleBtn.click();
    await page.waitForTimeout(300);

    const tokensInput = page.locator('#step-edit-card-0 input[oninput*="updateStepMaxTokens"]');

    // Test upper bound
    await tokensInput.fill('70000');
    await tokensInput.blur();
    await page.waitForTimeout(100);
    const value = await tokensInput.inputValue();
    expect(parseInt(value)).toBeLessThanOrEqual(65536);

    // Test lower bound
    await tokensInput.fill('100');
    await tokensInput.blur();
    await page.waitForTimeout(100);
    const value2 = await tokensInput.inputValue();
    expect(parseInt(value2)).toBeGreaterThanOrEqual(256);
  });

  test('should show missing credential warnings for keyless providers', async ({ page }) => {
    // Select a provider that requires API key (without setting one)
    await page.selectOption('#step-provider-0', 'openai');
    await page.waitForTimeout(500);

    // Should show warning in cred pill
    const credPill = page.locator('#step-edit-card-0 .step-cred-pill');
    await expect(credPill).toContainText('No Key');
  });

  test('should mark keyless providers (9Router, Custom) as ready without API key', async ({ page }) => {
    // Test 9Router
    await page.selectOption('#step-provider-0', 'ninerouter');
    await page.waitForTimeout(300);

    let credPill = page.locator('#step-edit-card-0 .step-cred-pill');
    await expect(credPill).toHaveClass(/keyless|ready/);
    await expect(credPill).toContainText('Local/Keyless');

    // Test Custom/Ollama
    await page.selectOption('#step-provider-0', 'custom');
    await page.waitForTimeout(300);

    credPill = page.locator('#step-edit-card-0 .step-cred-pill');
    await expect(credPill).toHaveClass(/keyless|ready/);
    await expect(credPill).toContainText('Local/Keyless');
  });

  test('should show workflow-level default Context Profile selector', async ({ page }) => {
    // Check workflow default profile dropdown
    const defaultProfileSelect = page.locator('#flowEditDefaultProfile');
    await expect(defaultProfileSelect).toBeVisible();

    // Should have "None" option
    const noneOption = defaultProfileSelect.locator('option[value=""]');
    await expect(noneOption).toContainText('None');

    // Should have actual profiles
    const profileOption = defaultProfileSelect.locator('option[value="prof-2"]');
    await expect(profileOption).toContainText('Senior TypeScript Architect');
  });

  test('should persist provider config after save and reload', async ({ page }) => {
    // Configure step with explicit provider and model
    await page.selectOption('#step-provider-0', 'gemini');
    await page.waitForTimeout(300);
    await page.selectOption('#step-model-0', 'gemini-3.8-flash');
    await page.selectOption('#step-profile-0', 'prof-2');

    const toggleBtn = page.locator('#step-edit-card-0 .flow-advanced-toggle-btn');
    await toggleBtn.click();
    await page.waitForTimeout(300);
    await page.fill('#step-edit-card-0 input[oninput*="updateStepTemperature"]', '0.5');
    await page.fill('#step-edit-card-0 input[oninput*="updateStepMaxTokens"]', '2048');

    // Save workflow
    await page.fill('#flowEditTitle', 'Provider Config Persistence');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    // Reload
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await page.click('.flow-picker-card:has-text("Provider Config Persistence")');
    await page.click('#flowTabEdit');

    // Verify persistence
    await expect(page.locator('#step-provider-0')).toHaveValue('gemini');
    await expect(page.locator('#step-model-0')).toHaveValue('gemini-3.8-flash');
    await expect(page.locator('#step-profile-0')).toHaveValue('prof-2');

    const toggleBtnReload = page.locator('#step-edit-card-0 .flow-advanced-toggle-btn');
    await toggleBtnReload.click();
    await page.waitForTimeout(300);
    await expect(page.locator('#step-edit-card-0 input[oninput*="updateStepTemperature"]')).toHaveValue('0.5');
    await expect(page.locator('#step-edit-card-0 input[oninput*="updateStepMaxTokens"]')).toHaveValue('2048');
  });

  test('should show validation alerts for missing credentials', async ({ page }) => {
    // Set a provider that needs credentials
    await page.selectOption('#step-provider-0', 'openai');
    await page.waitForTimeout(300);

    // Check validation alert appears
    const validationAlert = page.locator('#flowValidationAlert');
    await expect(validationAlert).toBeVisible();

    // Should show warning about missing key
    const validationList = page.locator('#flowValidationErrorsList');
    await expect(validationList).toContainText('Missing API Key');
  });

  test('should ensure credentials never appear in exported workflow JSON or snapshots', async ({ page }) => {
    // Configure step with explicit provider
    await page.selectOption('#step-provider-0', 'openai');
    await page.fill('#step-title-0', 'Secure Sanitization Step');
    await page.fill('#step-instruction-0', 'Sanitize check: {{input}}');

    // Save flow
    await page.fill('#flowEditTitle', 'Credential Security Audit Workflow');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');

    // Export - intercept download
    const downloadPromise = page.waitForEvent('download');
    await page.click('#btnExportFlows');
    const download = await downloadPromise;

    // Read export content
    const stream = await download.createReadStream();
    const chunks = [];
    const content = await new Promise(resolve => {
      stream.on('data', c => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });

    const parsed = JSON.parse(content);
    const rawExport = JSON.stringify(parsed);

    // Verify credentials never exist in export
    expect(rawExport).not.toMatch(/api[_-]?key/i);
    expect(rawExport).not.toMatch(/sk-[a-zA-Z0-9_-]{10,}/);
    expect(rawExport).not.toMatch(/AIzaSy/);
    expect(rawExport).not.toMatch(/gsk_/);

    // Verify steps have no apiKey properties
    const flows = Array.isArray(parsed.flows) ? parsed.flows : [];
    expect(flows.length).toBeGreaterThan(0);
    flows.forEach(flow => {
      flow.steps.forEach(s => {
        expect(s.apiKey).toBeUndefined();
        expect(s.credentials).toBeUndefined();
      });
    });
  });
});
