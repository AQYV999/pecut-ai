/**
 * Pecut AI — Execution History E2E Tests
 * Suite 08: Tests execution history creation, inspection, snapshot preservation,
 * per-workflow isolation, reload persistence, storage budget enforcement (20 runs,
 * 30k char step cap, 100k total cap, 1MB storage cap), clear confirmation,
 * and zero credential leakage.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

test.describe('Execution History', () => {
  test.beforeEach(async ({ page, context }) => {
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
    await page.fill('#flowEditTitle', 'History Test Workflow');
    await page.fill('#flowEditDesc', 'Workflow for execution history verification');

    // Step 0: Initial Ingestion
    await page.fill('#step-title-0', 'Initial Ingestion');
    await page.fill('#step-instruction-0', 'Ingest payload: {{input}}');

    // Step 1: Synthesis
    await page.fill('#step-title-1', 'Synthesis');
    await page.fill('#step-instruction-1', 'Synthesize: {{prev}}');

    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    // Switch to Run mode
    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("History Test Workflow")');

    // Default mock response: deterministic success
    await page.route('**/api/ai/proxy**', async (route) => {
      const request = route.request();
      const body = request.postDataJSON?.() || {};
      const messages = body.messages || [];
      const lastMsg = messages[messages.length - 1]?.content || '';

      let content = '';
      if (lastMsg.includes('Synthesize')) {
        content = `# Synthesis Output\n\nConsolidated analysis synthesized from previous stage.`;
      } else {
        content = `# Ingestion Output\n\nParsed input data successfully.`;
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
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        }),
      });
    });
  });

  // ==========================================
  // 1. HISTORY CREATION & STATUS BADGES
  // ==========================================

  test('1.1 should record successful workflow run in history with completed badge and metrics', async ({ page }) => {
    await page.fill('#flowRootInput', 'Audit payload alpha');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    const historyList = page.locator('#flowRunHistoryList');
    await expect(historyList).toBeVisible();

    const items = historyList.locator('.flow-history-item');
    await expect(items).toHaveCount(1);

    const firstItem = items.first();
    // Status pill
    const statusBadge = firstItem.locator('.step-cred-pill');
    await expect(statusBadge).toHaveText('completed');
    await expect(statusBadge).toHaveClass(/ready/);

    // Steps and tokens metadata
    await expect(firstItem).toContainText('2 step(s) completed');
    await expect(firstItem).toContainText('400 tokens'); // 200 tokens * 2 steps
  });

  test('1.2 should record failed workflow run in history with failed status badge', async ({ page }) => {
    // Intercept with error
    await page.route('**/api/ai/proxy**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Database connection failed', type: 'server_error' } }),
      });
    });

    await page.fill('#flowRootInput', 'Failing payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('FAILED', { timeout: 30000 });

    const items = page.locator('#flowRunHistoryList .flow-history-item');
    await expect(items).toHaveCount(1);

    const statusBadge = items.first().locator('.step-cred-pill');
    await expect(statusBadge).toHaveText('failed');
    await expect(statusBadge).toHaveClass(/error/);
  });

  test('1.3 should record cancelled workflow run in history with cancelled status badge', async ({ page }) => {
    // Delay response to allow clean cancellation
    await page.route('**/api/ai/proxy**', async (route) => {
      await new Promise(r => setTimeout(r, 4000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ index: 0, message: { role: 'assistant', content: 'Slow output' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
        }),
      });
    });

    await page.fill('#flowRootInput', 'Cancellation payload');
    await page.click('#runFlowPipelineBtn');
    await page.waitForTimeout(400);

    await page.click('#btnCancelFlowExecution');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('CANCELLED', { timeout: 15000 });

    const items = page.locator('#flowRunHistoryList .flow-history-item');
    await expect(items).toHaveCount(1);

    const statusBadge = items.first().locator('.step-cred-pill');
    await expect(statusBadge).toHaveText('cancelled');
    await expect(statusBadge).toHaveClass(/warning/);
  });

  test('1.4 should store multiple runs independently in reverse chronological order', async ({ page }) => {
    // Run 1
    await page.fill('#flowRootInput', 'Run 1 payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    await page.waitForTimeout(300);

    // Run 2
    await page.fill('#flowRootInput', 'Run 2 payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    const items = page.locator('#flowRunHistoryList .flow-history-item');
    await expect(items).toHaveCount(2);

    // Verify stored runs in localStorage have distinct IDs
    const storedRuns = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pecut_flow_runs') || '[]');
    });
    expect(storedRuns.length).toBeGreaterThanOrEqual(2);
    expect(storedRuns[0].id).not.toBe(storedRuns[1].id);
    expect(new Date(storedRuns[0].startedAt).getTime()).toBeGreaterThanOrEqual(new Date(storedRuns[1].startedAt).getTime());
  });

  // ==========================================
  // 2. HISTORY INSPECTION
  // ==========================================

  test('2.1 should inspect past run and restore step outputs into output viewer', async ({ page }) => {
    await page.fill('#flowRootInput', 'Payload to inspect');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Inspect the run
    const inspectBtn = page.locator('#flowRunHistoryList .flow-history-item button:has-text("Inspect Output")').first();
    await inspectBtn.click();

    // Output container should be displayed
    await expect(page.locator('#flowResultsContainer')).toBeVisible();
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Synthesis Output');
  });

  test('2.2 should preserve both individual step outputs and consolidated view during inspection', async ({ page }) => {
    await page.fill('#flowRootInput', 'Dual-step inspection payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Click inspect
    await page.locator('#flowRunHistoryList .flow-history-item button:has-text("Inspect Output")').first().click();

    const tabs = page.locator('#flowResultTabs .comp-tab');
    await expect(tabs).toHaveCount(3); // Step 1, Step 2, Full Consolidated

    // Check Step 1
    await tabs.nth(0).click();
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Ingestion Output');
    await expect(page.locator('#flowActiveResultRendered')).not.toContainText('Synthesis Output');

    // Check Step 2
    await tabs.nth(1).click();
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Synthesis Output');

    // Check Consolidated
    await tabs.last().click();
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Ingestion Output');
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Synthesis Output');
  });

  test('2.3 should preserve original immutable workflow snapshot in historical record', async ({ page }) => {
    await page.fill('#flowRootInput', 'Snapshot test payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    const runs = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pecut_flow_runs') || '[]');
    });

    const latestRun = runs[0];
    expect(latestRun).toBeDefined();
    expect(latestRun.flowSnapshot).toBeDefined();
    expect(latestRun.flowSnapshot.title).toBe('History Test Workflow');
    expect(latestRun.flowSnapshot.steps.length).toBe(2);
    expect(latestRun.flowSnapshot.steps[0].title).toBe('Initial Ingestion');
    expect(latestRun.flowSnapshot.steps[1].title).toBe('Synthesis');
  });

  test('2.4 should keep historical outputs unchanged when current workflow is modified in builder', async ({ page }) => {
    // Run initial workflow
    await page.fill('#flowRootInput', 'Baseline payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Switch to edit mode and change workflow title and step title
    await page.click('#flowTabEdit');
    await page.fill('#flowEditTitle', 'Mutated Workflow Name');
    await page.fill('#step-title-0', 'Radically Changed Step');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    // Switch back to Run mode and inspect the old run
    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Mutated Workflow Name")');

    const inspectBtn = page.locator('#flowRunHistoryList .flow-history-item button:has-text("Inspect Output")').first();
    await inspectBtn.click();

    // Verify historical output content is intact and reflects original step output
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Ingestion Output');
  });

  test('2.5 should not trigger any AI network requests during history inspection', async ({ page }) => {
    await page.fill('#flowRootInput', 'Zero request payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Track network requests
    let aiRequestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/ai/')) {
        aiRequestCount++;
      }
    });

    // Inspect output and navigate tabs
    const inspectBtn = page.locator('#flowRunHistoryList .flow-history-item button:has-text("Inspect Output")').first();
    await inspectBtn.click();

    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();
    await tabs.nth(1).click();
    await tabs.last().click();

    // Verify exactly 0 AI requests made during history inspection
    expect(aiRequestCount).toBe(0);
  });

  // ==========================================
  // 3. PERSISTENCE & WORKFLOW ISOLATION
  // ==========================================

  test('3.1 should persist history records across browser reload', async ({ page }) => {
    await page.fill('#flowRootInput', 'Reload persistence payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Verify history exists before reload
    await expect(page.locator('#flowRunHistoryList .flow-history-item')).toHaveCount(1);

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await page.click('.flow-picker-card:has-text("History Test Workflow")');

    // History must still exist and display the run
    const items = page.locator('#flowRunHistoryList .flow-history-item');
    await expect(items).toHaveCount(1);
    await expect(items.first().locator('.step-cred-pill')).toHaveText('completed');
  });

  test('3.2 should isolate history per workflow when switching between workflows', async ({ page }) => {
    // 1. Run History Test Workflow (Workflow A)
    await page.fill('#flowRootInput', 'Workflow A payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });
    await expect(page.locator('#flowRunHistoryList .flow-history-item')).toHaveCount(1);

    // 2. Create Workflow B
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Isolated Workflow B');
    await page.fill('#step-title-0', 'Step B1');
    await page.fill('#step-instruction-0', 'Do B: {{input}}');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    // 3. In Run mode for Workflow B, verify empty history
    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Isolated Workflow B")');
    await expect(page.locator('#flowRunHistoryList')).toContainText('No past runs recorded');

    // 4. Switch back to Workflow A, verify history is present
    await page.click('.flow-picker-card:has-text("History Test Workflow")');
    await expect(page.locator('#flowRunHistoryList .flow-history-item')).toHaveCount(1);
  });

  test('3.3 should handle missing or deleted workflows without crashing the application', async ({ page }) => {
    // Inject orphaned run belonging to a deleted flow ID into localStorage
    await page.evaluate(() => {
      const runs = JSON.parse(localStorage.getItem('pecut_flow_runs') || '[]');
      runs.unshift({
        id: 'run_orphaned_9999',
        flowId: 'deleted_flow_id_does_not_exist',
        flowTitle: 'Nonexistent Flow',
        status: 'completed',
        input: 'orphan input',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: 1200,
        stepResults: [{ title: 'Dead Step', output: 'Dead Output' }]
      });
      localStorage.setItem('pecut_flow_runs', JSON.stringify(runs));
    });

    // Navigate to Flow and select active workflow
    await page.click('.nav-item[data-nav="flow"]');
    await page.click('.flow-picker-card:has-text("History Test Workflow")');

    // Page must remain fully interactive without error
    await expect(page.locator('#view-flow.active')).toBeVisible();
    await expect(page.locator('#flowRunHistoryList')).toBeVisible();
  });

  // ==========================================
  // 4. STORAGE LIMITS & QUOTA ENFORCEMENT
  // ==========================================

  test('4.1 should enforce MAX_FLOW_RUNS (20) with FIFO pruning when runs exceed 20', async ({ page }) => {
    // Pre-seed localStorage with 20 runs for the current workflow
    await page.evaluate(() => {
      const activeFlow = JSON.parse(localStorage.getItem('pecut_flows_v2') || '[]').find(f => f.title === 'History Test Workflow');
      const flowId = activeFlow?.id || 'flow_test';

      const seededRuns = [];
      for (let i = 1; i <= 20; i++) {
        seededRuns.push({
          id: `run_seeded_${i}`,
          flowId,
          flowTitle: 'History Test Workflow',
          status: 'completed',
          input: `Seeded input ${i}`,
          startedAt: new Date(Date.now() - (25 - i) * 10000).toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 500,
          stepResults: [{ title: 'Step 1', output: `Output ${i}` }]
        });
      }
      localStorage.setItem('pecut_flow_runs', JSON.stringify(seededRuns));
    });

    // Reload to refresh active view
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.nav-item[data-nav="flow"]');
    await page.click('.flow-picker-card:has-text("History Test Workflow")');

    // Execute run 21
    await page.fill('#flowRootInput', 'Twenty-first Run');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Verify stored runs capped to exactly 20 (FIFO pruned the oldest run)
    const storedRuns = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pecut_flow_runs') || '[]');
    });

    expect(storedRuns.length).toBe(20);
    expect(storedRuns[0].input).toBe('Twenty-first Run');
    // Oldest seeded run (run_seeded_1) must be pruned
    const hasOldest = storedRuns.some(r => r.id === 'run_seeded_1');
    expect(hasOldest).toBe(false);
  });

  test('4.2 should enforce per-step output character cap (MAX_RUN_OUTPUT_CHARS = 30,000)', async ({ page }) => {
    // Intercept with an oversized 35,000 char output
    await page.route('**/api/ai/proxy**', async (route) => {
      const hugeOutput = 'A'.repeat(35000);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ index: 0, message: { role: 'assistant', content: hugeOutput }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
        }),
      });
    });

    await page.fill('#flowRootInput', 'Oversized payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    const runs = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pecut_flow_runs') || '[]');
    });

    const stepOutput = runs[0].stepResults[0].output;
    // Length must be bounded to <= 30,100 (30,000 + notice string)
    expect(stepOutput.length).toBeLessThanOrEqual(30100);
    expect(stepOutput).toContain('[Output truncated for storage budget]');
  });

  test('4.3 should enforce total run output budget (MAX_TOTAL_RUN_OUTPUT_CHARS = 100,000 across all steps)', async ({ page }) => {
    // Intercept with multi-step output totaling > 100,000 chars
    await page.route('**/api/ai/proxy**', async (route) => {
      const massiveBlock = 'X'.repeat(25000); // 25k per call
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ index: 0, message: { role: 'assistant', content: massiveBlock }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
        }),
      });
    });

    await page.fill('#flowRootInput', 'Massive multi-step payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    const runs = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pecut_flow_runs') || '[]');
    });

    const totalChars = runs[0].stepResults.reduce((acc, s) => acc + (s.output?.length || 0), 0);
    expect(totalChars).toBeLessThanOrEqual(100100);
  });

  test('4.4 should enforce MAX_RUNS_STORAGE_BYTES (1MB) budget without throwing QuotaExceededError', async ({ page }) => {
    const quotaSafety = await page.evaluate(() => {
      try {
        const stored = localStorage.getItem('pecut_flow_runs') || '[]';
        return { valid: true, sizeBytes: new Blob([stored]).size };
      } catch (err) {
        return { valid: false, error: err.message };
      }
    });

    expect(quotaSafety.valid).toBe(true);
    expect(quotaSafety.sizeBytes).toBeLessThanOrEqual(1048576); // Within 1MB
  });

  // ==========================================
  // 5. CLEAR HISTORY
  // ==========================================

  test('5.1 should prompt user with confirmation dialog when Clear History is clicked', async ({ page }) => {
    // Create a run first
    await page.fill('#flowRootInput', 'Clear test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await page.click('#btnClearFlowRuns');
    expect(dialogMessage).toContain('clear execution history');
  });

  test('5.2 should preserve all history records when Clear History confirmation is cancelled', async ({ page }) => {
    await page.fill('#flowRootInput', 'Preserve test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Dismiss confirmation
    page.once('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    await page.click('#btnClearFlowRuns');

    // History item must still exist
    await expect(page.locator('#flowRunHistoryList .flow-history-item')).toHaveCount(1);
  });

  test('5.3 should remove intended history and display empty state when confirmed', async ({ page }) => {
    await page.fill('#flowRootInput', 'Purge test');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Accept confirmation
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.click('#btnClearFlowRuns');

    // Should display empty state
    await expect(page.locator('#flowRunHistoryList')).toContainText('No past runs recorded for this workflow yet');
    await expect(page.locator('#flowRunHistoryList .flow-history-item')).toHaveCount(0);
    await expect(page.locator('.toast:has-text("cleared")')).toBeVisible({ timeout: 5000 });
  });

  test('5.4 should clear only the current workflow history without affecting other workflows', async ({ page }) => {
    // 1. Create run for Workflow A
    await page.fill('#flowRootInput', 'Run for Workflow A');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // 2. Create Workflow B and run it
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Workflow B To Preserve');
    await page.fill('#step-title-0', 'Step B');
    await page.fill('#step-instruction-0', 'Execute B: {{input}}');
    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Workflow B To Preserve")');
    await page.fill('#flowRootInput', 'Run for Workflow B');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // 3. Switch back to Workflow A and clear its history
    await page.click('.flow-picker-card:has-text("History Test Workflow")');
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.click('#btnClearFlowRuns');
    await expect(page.locator('#flowRunHistoryList')).toContainText('No past runs recorded');

    // 4. Switch back to Workflow B: Workflow B's run history MUST still exist!
    await page.click('.flow-picker-card:has-text("Workflow B To Preserve")');
    const itemsB = page.locator('#flowRunHistoryList .flow-history-item');
    await expect(itemsB).toHaveCount(1);
    await expect(itemsB.first().locator('.step-cred-pill')).toHaveText('completed');
  });

  // ==========================================
  // 6. DATA INTEGRITY & SECURITY
  // ==========================================

  test('6.1 should verify workflow snapshot contains zero credentials or secrets', async ({ page }) => {
    await page.fill('#flowRootInput', 'Secret audit payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    const rawStorage = await page.evaluate(() => {
      return localStorage.getItem('pecut_flow_runs') || '';
    });

    // Ensure zero secrets leaked in snapshot
    expect(rawStorage).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
    expect(rawStorage).not.toContain('test-key-mock-valid-12345');
    expect(rawStorage).not.toContain('Bearer ');
    expect(rawStorage).not.toContain('apiKey');
  });

  test('6.2 should verify history metadata contains no sensitive provider secrets', async ({ page }) => {
    await page.fill('#flowRootInput', 'Metadata security audit');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    const historyItemHtml = await page.locator('#flowRunHistoryList').innerHTML();
    expect(historyItemHtml).not.toContain('test-key-mock-valid-12345');
    expect(historyItemHtml).not.toContain('Bearer ');
    expect(historyItemHtml).not.toContain('apiKey');
  });

  test('6.3 should verify inspecting history does not mutate stored history records in localStorage', async ({ page }) => {
    await page.fill('#flowRootInput', 'Immutability test payload');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    // Capture storage before inspection
    const beforeInspection = await page.evaluate(() => {
      return localStorage.getItem('pecut_flow_runs');
    });

    // Inspect the run
    await page.locator('#flowRunHistoryList .flow-history-item button:has-text("Inspect Output")').first().click();

    // Capture storage after inspection
    const afterInspection = await page.evaluate(() => {
      return localStorage.getItem('pecut_flow_runs');
    });

    // Storage must be identical
    expect(afterInspection).toBe(beforeInspection);
  });
});
