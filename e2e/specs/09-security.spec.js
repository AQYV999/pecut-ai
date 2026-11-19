/**
 * Pecut AI — Suite 09: Security & Edge Cases E2E Tests
 * Comprehensive security verification: Credential Protection, XSS & Markdown Sanitization,
 * Malicious JSON Import, HTML Preview Isolation, Proxy Anti-SSRF, Browser Network Safety, and Storage Resilience.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

const SYNTHETIC_KEYS = {
  openrouter: 'sk-or-v1-SYNTHETIC-MOCK-SECRET-12345',
  openai: 'sk-proj-SYNTHETIC-OPENAI-KEY-99999',
  gemini: 'AIzaSy-SYNTHETIC-GEMINI-KEY-88888',
  groq: 'gsk_SYNTHETIC_GROQ_KEY_77777',
};

async function seedSyntheticBYOK(page) {
  await page.evaluate((keys) => {
    localStorage.setItem('pecut_byok_config', JSON.stringify({
      provider: 'openrouter',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      apiKey: keys.openrouter,
      baseUrl: 'https://openrouter.ai/api/v1'
    }));
    localStorage.setItem('pecut_byok_profiles', JSON.stringify({
      openrouter: { provider: 'openrouter', apiKey: keys.openrouter, model: 'meta-llama/llama-3.3-70b-instruct:free', baseUrl: 'https://openrouter.ai/api/v1' },
      openai: { provider: 'openai', apiKey: keys.openai, model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
      gemini: { provider: 'gemini', apiKey: keys.gemini, model: 'gemini-3.8-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
      groq: { provider: 'groq', apiKey: keys.groq, model: 'qwen/qwen3.8-27b', baseUrl: 'https://api.groq.com/openai/v1' },
      ninerouter: { provider: 'ninerouter', apiKey: '', model: 'VibeCoding', baseUrl: 'http://localhost:20128/v1' },
      custom: { provider: 'custom', apiKey: '', model: 'llama3:latest', baseUrl: 'http://localhost:11434/v1' }
    }));
  }, SYNTHETIC_KEYS);
}

async function mockAIProxySuccess(page, responseContent = 'Safe deterministic AI execution output.') {
  await page.route('**/api/ai/proxy**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent,
            reasoning: ''
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 },
        model: 'meta-llama/llama-3.3-70b-instruct:free'
      })
    });
  });
}

test.describe('Suite 09: Security & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedSyntheticBYOK(page);
  });

  // =========================================================================
  // 1. CREDENTIAL PROTECTION
  // =========================================================================
  test.describe('1. Credential Protection', () => {
    test('1.1 should not include API keys or Bearer tokens in workflow JSON exports', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const downloadPromise = page.waitForEvent('download');
      await page.click('#btnExportFlows');
      const download = await downloadPromise;

      const content = await download.createReadStream().then(stream => {
        const chunks = [];
        return new Promise(resolve => {
          stream.on('data', c => chunks.push(c));
          stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
        });
      });

      const exported = JSON.parse(content);
      const jsonStr = JSON.stringify(exported);

      expect(jsonStr).not.toContain(SYNTHETIC_KEYS.openrouter);
      expect(jsonStr).not.toContain(SYNTHETIC_KEYS.openai);
      expect(jsonStr).not.toContain(SYNTHETIC_KEYS.gemini);
      expect(jsonStr).not.toContain(SYNTHETIC_KEYS.groq);
      expect(jsonStr).not.toContain('Bearer ');
      expect(jsonStr).not.toMatch(/sk-[a-zA-Z0-9_-]{20,}/);
    });

    test('1.2 should not include API keys in execution snapshots inside stored runs', async ({ page }) => {
      await mockAIProxySuccess(page, 'Snapshot safe output');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'Snapshot credential test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const runs = await page.evaluate(() => {
        const stored = localStorage.getItem('pecut_flow_runs');
        return stored ? JSON.parse(stored) : [];
      });

      expect(runs.length).toBeGreaterThan(0);
      const latestRun = runs[0];
      const snapshotStr = JSON.stringify(latestRun.snapshot || {});

      expect(snapshotStr).not.toContain(SYNTHETIC_KEYS.openrouter);
      expect(snapshotStr).not.toContain(SYNTHETIC_KEYS.openai);
      expect(snapshotStr).not.toContain('Bearer ');
      expect(snapshotStr).not.toMatch(/sk-[a-zA-Z0-9_-]{20,}/);
    });

    test('1.3 should not include API keys in run history metadata or step results', async ({ page }) => {
      await mockAIProxySuccess(page, 'History credential verify');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'History verify');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const runsJson = await page.evaluate(() => localStorage.getItem('pecut_flow_runs') || '[]');
      expect(runsJson).not.toContain(SYNTHETIC_KEYS.openrouter);
      expect(runsJson).not.toContain(SYNTHETIC_KEYS.openai);
      expect(runsJson).not.toContain('Bearer ');
    });

    test('1.4 should not include API keys in generated Markdown downloads', async ({ page }) => {
      await mockAIProxySuccess(page, 'Download markdown clean output');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'Markdown credential test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const downloadPromise = page.waitForEvent('download');
      await page.click('#downloadFlowResultBtn');
      const download = await downloadPromise;

      const content = await download.createReadStream().then(stream => {
        const chunks = [];
        return new Promise(resolve => {
          stream.on('data', c => chunks.push(c));
          stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
        });
      });

      expect(content).not.toContain(SYNTHETIC_KEYS.openrouter);
      expect(content).not.toContain(SYNTHETIC_KEYS.openai);
      expect(content).not.toContain('Bearer ');
      expect(content).not.toMatch(/sk-[a-zA-Z0-9_-]{20,}/);
    });

    test('1.5 should not log API keys in browser console during operations', async ({ page }) => {
      const consoleLogs = [];
      page.on('console', msg => consoleLogs.push(msg.text()));

      await page.click('.nav-item[data-nav="settings"]');
      await expect(page.locator('#view-settings.active')).toBeVisible();

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const allLogs = consoleLogs.join(' ');
      expect(allLogs).not.toContain(SYNTHETIC_KEYS.openrouter);
      expect(allLogs).not.toContain(SYNTHETIC_KEYS.openai);
      expect(allLogs).not.toContain('Bearer ');
    });

    test('1.6 should not leak credentials in rendered output viewer DOM', async ({ page }) => {
      await mockAIProxySuccess(page, 'Public rendered output content.');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'DOM leak test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const renderedHTML = await page.locator('#flowActiveResultRendered').innerHTML();
      expect(renderedHTML).not.toContain(SYNTHETIC_KEYS.openrouter);
      expect(renderedHTML).not.toContain(SYNTHETIC_KEYS.openai);
      expect(renderedHTML).not.toContain('Bearer ');
    });
  });

  // =========================================================================
  // 2. XSS & MARKDOWN SECURITY
  // =========================================================================
  test.describe('2. XSS & Markdown Security', () => {
    test('2.1 should sanitize script tags and keep them completely inert', async ({ page }) => {
      await mockAIProxySuccess(page, 'Notice: <script>window.__xss_flag = "script_executed";</script>');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'XSS script test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const isExecuted = await page.evaluate(() => window.__xss_flag);
      expect(isExecuted).toBeUndefined();

      const rendered = page.locator('#flowActiveResultRendered');
      const innerHTML = await rendered.innerHTML();
      expect(innerHTML).not.toMatch(/<script[\s>]/i);
      expect(innerHTML).toContain('&lt;script&gt;');
    });

    test('2.2 should sanitize iframe injection payloads in output viewer', async ({ page }) => {
      await mockAIProxySuccess(page, 'Iframe attempt: <iframe src="javascript:window.__xss_flag = 1"></iframe>');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'Iframe test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const isExecuted = await page.evaluate(() => window.__xss_flag);
      expect(isExecuted).toBeUndefined();

      const rendered = page.locator('#flowActiveResultRendered');
      expect(await rendered.locator('iframe').count()).toBe(0);
    });

    test('2.3 should sanitize SVG onload payloads and prevent code execution', async ({ page }) => {
      await mockAIProxySuccess(page, 'SVG test: <svg onload="window.__xss_flag = 1"><circle r="10"/></svg>');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'SVG test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const isExecuted = await page.evaluate(() => window.__xss_flag);
      expect(isExecuted).toBeUndefined();

      const rendered = page.locator('#flowActiveResultRendered');
      expect(await rendered.locator('svg').count()).toBe(0);
    });

    test('2.4 should sanitize onerror and event handler attributes', async ({ page }) => {
      await mockAIProxySuccess(page, 'Error handler test: <img src="invalid_img" onerror="window.__xss_flag = 1">');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'Onerror test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const isExecuted = await page.evaluate(() => window.__xss_flag);
      expect(isExecuted).toBeUndefined();

      // Verify no DOM element in rendered output carries an executable onerror attribute
      const hasOnerrorAttr = await page.evaluate(() => {
        return Boolean(document.querySelector('#flowActiveResultRendered [onerror]'));
      });
      expect(hasOnerrorAttr).toBe(false);

      // Verify no img element was injected into the DOM
      expect(await page.locator('#flowActiveResultRendered img').count()).toBe(0);
    });

    test('2.5 should neutralize malicious javascript: and data: URLs in markdown links', async ({ page }) => {
      await mockAIProxySuccess(page, 'Links: [Click Me](javascript:window.__xss_flag=1) and [Data Payload](data:text/html,<script>window.__xss_flag=1</script>)');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'Markdown links test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const links = page.locator('#flowActiveResultRendered a');
      const count = await links.count();
      for (let i = 0; i < count; i++) {
        const href = await links.nth(i).getAttribute('href');
        expect(href).not.toMatch(/^javascript:/i);
        expect(href).not.toMatch(/^data:/i);
      }
    });

    test('2.6 should neutralize malicious javascript: and data: URLs in markdown images', async ({ page }) => {
      await mockAIProxySuccess(page, 'Images: ![XSS](javascript:window.__xss_flag=1) and ![Data](data:image/svg+xml,<svg onload=alert(1)>)');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'Markdown images test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const images = page.locator('#flowActiveResultRendered img');
      const count = await images.count();
      for (let i = 0; i < count; i++) {
        const src = await images.nth(i).getAttribute('src');
        expect(src).not.toMatch(/^javascript:/i);
        expect(src).not.toMatch(/^data:/i);
      }
    });

    test('2.7 should sanitize HTML injection inside Markdown tables', async ({ page }) => {
      const tablePayload = `| Header 1 | Header 2 |\n|---|---|\n| <script>window.__xss_flag=1</script> | <img src=x onerror=window.__xss_flag=1> |`;
      await mockAIProxySuccess(page, tablePayload);

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'Table injection test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const isExecuted = await page.evaluate(() => window.__xss_flag);
      expect(isExecuted).toBeUndefined();

      // Verify no executable script or element with onerror inside table DOM
      const hasActiveScript = await page.evaluate(() => {
        return Boolean(document.querySelector('#flowActiveResultRendered table script'));
      });
      expect(hasActiveScript).toBe(false);

      const hasOnerrorInTable = await page.evaluate(() => {
        return Boolean(document.querySelector('#flowActiveResultRendered table [onerror]'));
      });
      expect(hasOnerrorInTable).toBe(false);
    });
  });

  // =========================================================================
  // 3. MALICIOUS JSON IMPORT
  // =========================================================================
  test.describe('3. Malicious JSON Import', () => {
    test('3.1 should reject invalid non-JSON content with error notification', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const fileInput = page.locator('#flowFileInput');
      await fileInput.setInputFiles({
        name: 'corrupt.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{ unclosed invalid json string')
      });

      await expect(page.locator('.toast.toast-error, .toast:has-text("Import failed")')).toBeVisible({ timeout: 5000 });
    });

    test('3.2 should reject JSON with missing required schema fields', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const fileInput = page.locator('#flowFileInput');
      await fileInput.setInputFiles({
        name: 'missing-fields.pecut-flow.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          schemaVersion: 'pecut.flow.v2',
          flows: [{ id: 'flow-broken', description: 'Missing title and steps' }]
        }))
      });

      await expect(page.locator('.toast.toast-error, .toast:has-text("Import failed")')).toBeVisible({ timeout: 5000 });
    });

    test('3.3 should prevent prototype pollution from imported JSON payloads', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const fileInput = page.locator('#flowFileInput');
      await fileInput.setInputFiles({
        name: 'proto-pollution.pecut-flow.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          __proto__: { polluted: true },
          flows: [{ title: 'Pollution Test', steps: [{ instruction: 'test' }] }]
        }))
      });

      await page.waitForTimeout(500);
      const isPolluted = await page.evaluate(() => Object.prototype.polluted);
      expect(isPolluted).toBeUndefined();
    });

    test('3.4 should reject workflow JSON containing malicious workflow IDs', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const fileInput = page.locator('#flowFileInput');
      await fileInput.setInputFiles({
        name: 'malicious-flow-id.pecut-flow.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          flows: [{
            id: '<script>alert(1)</script>',
            title: 'Malicious Flow ID',
            steps: [{ id: 'step_1_ok', instruction: 'Do work' }]
          }]
        }))
      });

      await expect(page.locator('.toast.toast-error, .toast:has-text("Import failed")')).toBeVisible({ timeout: 5000 });
    });

    test('3.5 should reject workflow JSON containing malicious step IDs', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const fileInput = page.locator('#flowFileInput');
      await fileInput.setInputFiles({
        name: 'malicious-step-id.pecut-flow.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          flows: [{
            id: 'flow_safe_id_1',
            title: 'Malicious Step ID',
            steps: [{ id: '<script>alert(1)</script>', instruction: 'Do work' }]
          }]
        }))
      });

      await expect(page.locator('.toast.toast-error, .toast:has-text("Import failed")')).toBeVisible({ timeout: 5000 });
    });

    test('3.6 should reject workflow JSON with duplicate step IDs within a single workflow', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const fileInput = page.locator('#flowFileInput');
      await fileInput.setInputFiles({
        name: 'duplicate-step-id.pecut-flow.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          flows: [{
            id: 'flow_dup_check',
            title: 'Duplicate Step ID Flow',
            steps: [
              { id: 'step_1_common', instruction: 'First step' },
              { id: 'step_1_common', instruction: 'Second duplicate step' }
            ]
          }]
        }))
      });

      await expect(page.locator('.toast.toast-error, .toast:has-text("Import failed")')).toBeVisible({ timeout: 5000 });
    });

    test('3.7 should strip injected credentials in imported workflow data without storing secrets', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const fileInput = page.locator('#flowFileInput');
      await fileInput.setInputFiles({
        name: 'credential-injection.pecut-flow.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          flows: [{
            id: 'flow_cred_inj_' + Date.now(),
            title: 'Cred Injection Test',
            apiKey: 'sk-injected-secret-key-12345',
            steps: [
              { id: 'step_1_cinj', instruction: 'Step instruction', apiKey: 'sk-step-injected' }
            ]
          }]
        }))
      });

      await expect(page.locator('.toast:has-text("Successfully imported")')).toBeVisible({ timeout: 5000 });

      const storedFlows = await page.evaluate(() => {
        const raw = localStorage.getItem('pecut_flows');
        return raw ? JSON.parse(raw) : [];
      });

      const imported = storedFlows.find(f => f.title === 'Cred Injection Test');
      expect(imported).toBeDefined();
      expect(imported.apiKey).toBeUndefined();
      expect(imported.steps[0].apiKey).toBeUndefined();
    });

    test('3.8 should preserve all existing workflows intact when malicious imports are rejected', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const initialCount = await page.evaluate(() => {
        const raw = localStorage.getItem('pecut_flows');
        return raw ? JSON.parse(raw).length : 0;
      });

      const fileInput = page.locator('#flowFileInput');
      await fileInput.setInputFiles({
        name: 'reject-preserve.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{ broken json')
      });

      await expect(page.locator('.toast.toast-error, .toast:has-text("Import failed")')).toBeVisible({ timeout: 5000 });

      const postCount = await page.evaluate(() => {
        const raw = localStorage.getItem('pecut_flows');
        return raw ? JSON.parse(raw).length : 0;
      });

      expect(postCount).toBe(initialCount);
    });
  });

  // =========================================================================
  // 4. HTML PREVIEW ISOLATION
  // =========================================================================
  test.describe('4. HTML Preview Isolation', () => {
    test('4.1 should render preview iframe with required sandbox attributes', async ({ page }) => {
      await page.evaluate(() => {
        window.openHtmlPreviewModal('<h1>Sandboxed Preview</h1>');
      });

      const previewFrame = page.locator('#chatHtmlPreviewFrame');
      await expect(previewFrame).toBeAttached({ timeout: 5000 });

      const sandboxAttr = await previewFrame.getAttribute('sandbox');
      expect(sandboxAttr).toContain('allow-scripts');
      expect(sandboxAttr).toContain('allow-modals');
    });

    test('4.2 should strictly omit allow-same-origin from sandbox attribute', async ({ page }) => {
      await page.evaluate(() => {
        window.openHtmlPreviewModal('<h1>No Same Origin</h1>');
      });

      const previewFrame = page.locator('#chatHtmlPreviewFrame');
      await expect(previewFrame).toBeAttached({ timeout: 5000 });
      const sandboxAttr = await previewFrame.getAttribute('sandbox');
      expect(sandboxAttr).not.toContain('allow-same-origin');
    });

    test('4.3 should strictly omit allow-top-navigation from sandbox attribute', async ({ page }) => {
      await page.evaluate(() => {
        window.openHtmlPreviewModal('<h1>No Top Navigation</h1>');
      });

      const previewFrame = page.locator('#chatHtmlPreviewFrame');
      await expect(previewFrame).toBeAttached({ timeout: 5000 });
      const sandboxAttr = await previewFrame.getAttribute('sandbox');
      expect(sandboxAttr).not.toContain('allow-top-navigation');
    });

    test('4.4 should enforce opaque null origin preventing iframe access to parent DOM', async ({ page }) => {
      await page.evaluate(() => {
        window.__parent_dom_compromised = false;
        window.openHtmlPreviewModal(`
          <script>
            try {
              window.parent.document.body.innerHTML = 'HACKED';
              window.parent.__parent_dom_compromised = true;
            } catch (e) {
              // Expected cross-origin SecurityError
            }
          </script>
        `);
      });

      await page.waitForTimeout(1000);
      const isCompromised = await page.evaluate(() => window.__parent_dom_compromised);
      expect(isCompromised).toBe(false);
    });

    test('4.5 should enforce opaque null origin preventing iframe access to parent localStorage', async ({ page }) => {
      await page.evaluate(() => {
        window.__storage_compromised = false;
        window.openHtmlPreviewModal(`
          <script>
            try {
              window.parent.localStorage.clear();
              window.parent.__storage_compromised = true;
            } catch (e) {
              // Expected cross-origin SecurityError
            }
          </script>
        `);
      });

      await page.waitForTimeout(1000);
      const isCompromised = await page.evaluate(() => window.__storage_compromised);
      expect(isCompromised).toBe(false);
      // Verify storage was not cleared
      const hasFlows = await page.evaluate(() => Boolean(localStorage.getItem('pecut_flows')));
      expect(hasFlows).toBe(true);
    });
  });

  // =========================================================================
  // 5. PROXY SECURITY (ANTI-SSRF & NETWORK BOUNDARY)
  // =========================================================================
  test.describe('5. Proxy Security (Anti-SSRF & Boundary Checks)', () => {
    test('5.1 should reject disallowed target domain with HTTP 403 Forbidden', async ({ page }) => {
      const response = await page.request.post('/api/ai/proxy', {
        headers: {
          'x-target-url': 'https://evil-unauthorized-target.com/api',
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        data: { message: 'test' }
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Forbidden');
    });

    test('5.2 should reject unencrypted HTTP target in production mode with HTTP 403', async ({ page }) => {
      const response = await page.request.post('/api/ai/proxy', {
        headers: {
          'x-target-url': 'http://openrouter.ai/api/v1/chat/completions',
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        data: { message: 'test' }
      });

      expect(response.status()).toBe(403);
    });

    test('5.3 should reject cloud metadata IP (169.254.169.254) with HTTP 403 (Anti-SSRF)', async ({ page }) => {
      const response = await page.request.post('/api/ai/proxy', {
        headers: {
          'x-target-url': 'http://169.254.169.254/latest/meta-data/',
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        data: {}
      });

      expect(response.status()).toBe(403);
    });

    test('5.4 should reject requests missing required x-target-url header with HTTP 400', async ({ page }) => {
      const response = await page.request.post('/api/ai/proxy', {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        data: { message: 'test' }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Missing required header: x-target-url');
    });

    test('5.5 should reject requests missing Authorization or x-goog-api-key header with HTTP 400', async ({ page }) => {
      const response = await page.request.post('/api/ai/proxy', {
        headers: {
          'x-target-url': 'https://openrouter.ai/api/v1/chat/completions',
          'Content-Type': 'application/json'
        },
        data: { message: 'test' }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Missing required Authorization');
    });

    test('5.6 should reject payloads exceeding 2MB limit with HTTP 413 Payload Too Large', async ({ page }) => {
      const oversizedPayload = 'x'.repeat(2 * 1024 * 1024 + 100);
      const response = await page.request.post('/api/ai/proxy', {
        headers: {
          'x-target-url': 'https://openrouter.ai/api/v1/chat/completions',
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
          'Content-Length': String(oversizedPayload.length)
        },
        data: oversizedPayload
      });

      expect(response.status()).toBe(413);
      const body = await response.json();
      expect(body.error).toContain('Payload Too Large');
    });
  });

  // =========================================================================
  // 6. BROWSER NETWORK SAFETY
  // =========================================================================
  test.describe('6. Browser Network Safety', () => {
    test('6.1 should not make unexpected third-party external network requests', async ({ page }) => {
      const externalCalls = [];

      page.on('request', req => {
        const url = req.url();
        if (url.startsWith('http') &&
            !url.includes('127.0.0.1') &&
            !url.includes('localhost') &&
            !url.includes('fonts.googleapis.com') &&
            !url.includes('fonts.gstatic.com')) {
          externalCalls.push(url);
        }
      });

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.waitForTimeout(1000);

      expect(externalCalls.length).toBe(0);
    });

    test('6.2 should not trigger AI provider network requests when inspecting old execution history', async ({ page }) => {
      await mockAIProxySuccess(page, 'Past run output for zero network check');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'History inspection network check');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      // Count network requests during inspection
      let networkCallsCount = 0;
      page.on('request', req => {
        if (req.url().includes('/api/ai/')) {
          networkCallsCount++;
        }
      });

      await page.click('.nav-item[data-nav="history"]');
      const inspectBtn = page.locator('#flowRunHistoryList .flow-history-item button:has-text("Inspect Output")').first();
      if (await inspectBtn.isVisible()) {
        await inspectBtn.click();
        await page.waitForTimeout(1000);
      }

      expect(networkCallsCount).toBe(0);
    });

    test('6.3 should ensure external links open safely without top-level parent window redirect', async ({ page }) => {
      await mockAIProxySuccess(page, 'Safe external link: [External Docs](https://example.com/docs)');

      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');
      await page.fill('#flowRootInput', 'Link test');
      await page.click('#runFlowPipelineBtn');

      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const link = page.locator('#flowActiveResultRendered a:has-text("External Docs")');
      await expect(link).toBeVisible();

      expect(await link.getAttribute('target')).toBe('_blank');
      expect(await link.getAttribute('rel')).toContain('noopener');
    });
  });

  // =========================================================================
  // 7. STORAGE SECURITY & RESILIENCE
  // =========================================================================
  test.describe('7. Storage Security & Resilience', () => {
    test('7.1 should recover gracefully without crash when pecut_flows is corrupted with malformed data', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('pecut_flows', '{ malformed invalid json {{{');
      });

      // Reload page and navigate to flow
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.click('.nav-item[data-nav="flow"]');

      // Application should not crash, flow selector list should auto-seed valid default flows
      await expect(page.locator('#flowSelectorList')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#flowSelectorList .flow-picker-card').first()).toBeVisible({ timeout: 5000 });

      const flows = await page.evaluate(() => {
        const raw = localStorage.getItem('pecut_flows');
        return raw ? JSON.parse(raw) : [];
      });
      expect(Array.isArray(flows)).toBe(true);
      expect(flows.length).toBeGreaterThan(0);
    });

    test('7.2 should recover gracefully without crash when pecut_flow_runs is corrupted with malformed data', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('pecut_flow_runs', 'not a valid json array :::');
      });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.click('.nav-item[data-nav="flow"]');

      // History should handle corruption cleanly and show empty state or recover
      const historyList = page.locator('#flowRunHistoryList');
      await expect(historyList).toBeVisible();
      await expect(historyList).toContainText('No past runs recorded');
    });

    test('7.3 should preserve existing user workflows completely when malformed imports are rejected', async ({ page }) => {
      await page.click('.nav-item[data-nav="flow"]');
      await page.click('#flowTabRun');

      const initialFlows = await page.evaluate(() => {
        const raw = localStorage.getItem('pecut_flows');
        return raw ? JSON.parse(raw) : [];
      });
      expect(initialFlows.length).toBeGreaterThan(0);

      const fileInput = page.locator('#flowFileInput');
      await fileInput.setInputFiles({
        name: 'corrupted-payload.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{ completely broken file')
      });

      await expect(page.locator('.toast.toast-error, .toast:has-text("Import failed")')).toBeVisible({ timeout: 5000 });

      const currentFlows = await page.evaluate(() => {
        const raw = localStorage.getItem('pecut_flows');
        return raw ? JSON.parse(raw) : [];
      });

      expect(currentFlows.length).toBe(initialFlows.length);
      expect(currentFlows[0].id).toBe(initialFlows[0].id);
    });
  });
});
