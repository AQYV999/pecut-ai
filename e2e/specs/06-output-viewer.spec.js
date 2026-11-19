/**
 * Pecut AI — Output Viewer E2E Tests
 * Suite 06: Tests per-step output navigation, consolidated view,
 * markdown formatting, raw/rendered modes, XSS sanitization,
 * code/output copying, reasoning summaries, and edge cases.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

test.describe('Output Viewer', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard permissions for copy actions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

    // 1. Seed localStorage before navigation
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

    // Create a 3-step test workflow
    await page.click('#flowTabEdit');
    await page.click('#btnCreateFlow');
    await page.fill('#flowEditTitle', 'Output Viewer Test Workflow');
    await page.fill('#flowEditDesc', 'Workflow for output viewer validation');

    // Step 0: Research
    await page.fill('#step-title-0', 'Research');
    await page.fill('#step-instruction-0', 'Research: {{input}}');

    // Step 1: Technical Analysis
    await page.fill('#step-title-1', 'Technical Analysis');
    await page.fill('#step-instruction-1', 'Analyze: {{prev}}');

    // Step 2: Critical Review
    await page.click('#btnAddStepBtn');
    await page.waitForTimeout(300);
    await page.fill('#step-title-2', 'Critical Review');
    await page.fill('#step-instruction-2', 'Review: {{step1}} and {{prev}}');

    await page.click('#btnSaveFlow');
    await expect(page.locator('.toast:has-text("saved")').last()).toBeVisible({ timeout: 5000 });

    await page.click('#flowTabRun');
    await page.click('.flow-picker-card:has-text("Output Viewer Test Workflow")');

    // Mock rich markdown responses for each step
    await page.route('**/api/ai/proxy**', async (route, request) => {
      const body = request.postDataJSON?.() || {};
      const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

      let content = '';
      let reasoning = '';

      if (userPrompt.includes('Research:')) {
        content = `# Research Findings

## Overview
Comprehensive research on autonomous systems.

### Key Points
- **Point 1**: Bold text formatting
- *Point 2*: Italic text formatting
- \`Point 3\`: Inline code formatting

#### Table Example
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data A   | Data B   | Data C   |
| Data D   | Data E   | Data F   |

\`\`\`javascript
function test() {
  return "Hello World";
}
\`\`\`

> Blockquote insight
`;
        reasoning = 'Detailed internal reasoning for Step 1 research.';
      } else if (userPrompt.includes('Analyze:')) {
        content = `## Technical Analysis

### Specifications
1. Architectural modularity
2. Zero-dependency standard
3. High concurrency resilience

**Strict** and *verifiable* execution models.

\`\`\`python
def analyze(data):
    return {"status": "success", "processed": data}
\`\`\`
`;
        reasoning = 'Architectural evaluation and tradeoff analysis.';
      } else {
        content = `## Critical Review

### Assessment
- Quality standard met
- Reliability verified

### Recommendations
1. Scale horizontal nodes
2. Maintain end-to-end tests

\`\`\`json
{
  "verdict": "approved",
  "score": 98
}
\`\`\`
`;
        reasoning = '';
      }

      await route.fulfill({
        json: {
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content,
                reasoning
              },
              finish_reason: 'stop'
            }
          ],
          usage: { prompt_tokens: 120, completion_tokens: 180, total_tokens: 300 }
        }
      });
    });

    await page.fill('#flowRootInput', 'Comprehensive AI Systems Evaluation');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 60000 });
  });

  test('should show per-step output tabs with correct ordering and content', async ({ page }) => {
    // Results container should be visible
    await expect(page.locator('#flowResultsContainer')).toBeVisible();

    // Exactly 4 tabs: Step 1, Step 2, Step 3, Consolidated
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await expect(tabs).toHaveCount(4);

    // Tab 1: Step 1 Research
    await tabs.nth(0).click();
    await expect(tabs.nth(0)).toHaveClass(/active/);
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Research Findings');

    // Tab 2: Step 2 Technical Analysis
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveClass(/active/);
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Technical Analysis');

    // Tab 3: Step 3 Critical Review
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveClass(/active/);
    await expect(page.locator('#flowActiveResultRendered')).toContainText('Critical Review');
  });

  test('should show consolidated pipeline output containing all completed step outputs', async ({ page }) => {
    // Click consolidated tab (last tab)
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(3).click();
    await expect(tabs.nth(3)).toHaveClass(/active/);

    const consolidated = page.locator('#flowActiveResultRendered');
    await expect(consolidated).toContainText('Step 1: Research');
    await expect(consolidated).toContainText('Research Findings');
    await expect(consolidated).toContainText('Step 2: Technical Analysis');
    await expect(consolidated).toContainText('Architectural modularity');
    await expect(consolidated).toContainText('Step 3: Critical Review');
    await expect(consolidated).toContainText('Quality standard met');
  });

  test('should switch between tabs without losing or corrupting content', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');

    // Switch to step 1
    await tabs.nth(0).click();
    const step1Content = await page.locator('#flowActiveResultRendered').textContent();
    expect(step1Content).toContain('Research Findings');

    // Switch to step 2
    await tabs.nth(1).click();
    expect(await page.locator('#flowActiveResultRendered').textContent()).toContain('Technical Analysis');

    // Switch back to step 1 and verify content is preserved exactly
    await tabs.nth(0).click();
    const restoredStep1 = await page.locator('#flowActiveResultRendered').textContent();
    expect(restoredStep1).toBe(step1Content);
  });

  test('should render Markdown headings (h1, h2, h3, h4)', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();

    const rendered = page.locator('#flowActiveResultRendered');
    await expect(rendered.locator('h1')).toContainText('Research Findings');
    await expect(rendered.locator('h2')).toContainText('Overview');
    await expect(rendered.locator('h3')).toContainText('Key Points');
    await expect(rendered.locator('h4')).toContainText('Table Example');
  });

  test('should render bold and italic formatting', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();

    const rendered = page.locator('#flowActiveResultRendered');
    // Bold
    await expect(rendered.locator('strong')).toContainText('Point 1');
    // Italic
    await expect(rendered.locator('em')).toContainText('Point 2');
  });

  test('should render Markdown tables', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();

    const rendered = page.locator('#flowActiveResultRendered');
    await expect(rendered.locator('table')).toBeVisible();
    await expect(rendered.locator('th:has-text("Column 1")')).toBeVisible();
    await expect(rendered.locator('td:has-text("Data A")')).toBeVisible();
  });

  test('should render lists (ordered and unordered)', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');

    // Step 1 has unordered list
    await tabs.nth(0).click();
    const rendered1 = page.locator('#flowActiveResultRendered');
    await expect(rendered1.locator('ul li').first()).toBeVisible();

    // Step 2 has ordered list
    await tabs.nth(1).click();
    const rendered2 = page.locator('#flowActiveResultRendered');
    await expect(rendered2.locator('ol li').first()).toBeVisible();
  });

  test('should render inline code and fenced code blocks with language tags', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();

    const rendered = page.locator('#flowActiveResultRendered');
    // Inline code
    await expect(rendered.locator('code:has-text("Point 3")')).toBeVisible();

    // Fenced code block
    const jsBlock = rendered.locator('pre code.language-javascript');
    await expect(jsBlock).toBeVisible();
    await expect(jsBlock).toContainText('function test()');
  });

  test('should toggle between Rendered Markdown and Raw Text modes preserving content', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();

    // Default mode is Rendered Markdown
    await expect(page.locator('#btnModeMarkdown')).toHaveClass(/active/);
    await expect(page.locator('#flowActiveResultRendered')).toBeVisible();
    await expect(page.locator('#flowActiveResultOutput')).toBeHidden();

    // Switch to Raw Text mode
    await page.click('#btnModeRaw');
    await expect(page.locator('#btnModeRaw')).toHaveClass(/active/);
    await expect(page.locator('#btnModeMarkdown')).not.toHaveClass(/active/);
    await expect(page.locator('#flowActiveResultOutput')).toBeVisible();
    await expect(page.locator('#flowActiveResultRendered')).toBeHidden();

    // Raw mode contains markdown source
    const rawContent = await page.locator('#flowActiveResultOutput').textContent();
    expect(rawContent).toContain('# Research Findings');
    expect(rawContent).toContain('```javascript');

    // Switch back to Rendered Markdown mode
    await page.click('#btnModeMarkdown');
    await expect(page.locator('#btnModeMarkdown')).toHaveClass(/active/);
    await expect(page.locator('#flowActiveResultRendered')).toBeVisible();
    await expect(page.locator('#flowActiveResultRendered h1')).toContainText('Research Findings');
  });

  test('should copy individual step output to clipboard via Copy button', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();

    // Click Copy Result button
    await page.click('#copyFlowResultBtn');
    await expect(page.locator('.toast:has-text("copied")').last()).toBeVisible({ timeout: 5000 });

    // Verify clipboard content
    const clipboardText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (_) {
        return null;
      }
    });

    if (clipboardText) {
      expect(clipboardText).toContain('Research Findings');
    }
  });

  test('should copy consolidated output to clipboard', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(3).click(); // Consolidated tab

    await page.click('#copyFlowResultBtn');
    await expect(page.locator('.toast:has-text("copied")').last()).toBeVisible({ timeout: 5000 });

    const clipboardText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (_) {
        return null;
      }
    });

    if (clipboardText) {
      expect(clipboardText).toContain('Step 1: Research');
      expect(clipboardText).toContain('Step 2: Technical Analysis');
    }
  });

  test('should copy individual code block content via code block copy button', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();

    const copyBtn = page.locator('#flowActiveResultRendered .btn-copy-code').first();
    await expect(copyBtn).toBeVisible();

    await copyBtn.click();
    await expect(page.locator('.toast:has-text("disalin")').last()).toBeVisible({ timeout: 5000 });

    const clipboardText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (_) {
        return null;
      }
    });

    if (clipboardText) {
      expect(clipboardText).toContain('function test()');
    }
  });

  test('should display Reasoning Summary details when provider exposes thinking process', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();

    const thinkingContainer = page.locator('#flowThinkingContainer');
    await expect(thinkingContainer.locator('.flow-thinking-box')).toBeVisible();
    await expect(thinkingContainer.locator('summary')).toContainText('Thinking Process');
    await expect(thinkingContainer.locator('pre')).toContainText('Detailed internal reasoning for Step 1 research.');
  });

  test('should gracefully hide Reasoning Summary when provider has no reasoning tokens', async ({ page }) => {
    const tabs = page.locator('#flowResultTabs .comp-tab');
    // Step 3 was returned with reasoning = ''
    await tabs.nth(2).click();

    const thinkingContainer = page.locator('#flowThinkingContainer');
    const content = await thinkingContainer.innerHTML();
    expect(content.trim()).toBe('');
  });

  test.describe('Security - XSS Sanitization', () => {
    test('should sanitize script tags, iframes, and svg payloads', async ({ page }) => {
      // Test payload injection via runner
      await page.route('**/api/ai/proxy**', async (route) => {
        await route.fulfill({
          json: {
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: '<script>alert("xss")</script><iframe src="javascript:alert(1)"></iframe><svg onload="alert(1)"></svg><p>Safe Paragraph</p>',
                reasoning: '<script>alert("reasoning-xss")</script>'
              },
              finish_reason: 'stop'
            }],
            usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 }
          }
        });
      });

      await page.fill('#flowRootInput', 'XSS sanitization probe');
      await page.click('#runFlowPipelineBtn');
      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const rendered = page.locator('#flowActiveResultRendered');
      const innerHtml = await rendered.innerHTML();

      // Ensure no live executable elements exist in DOM
      expect(await rendered.locator('script').count()).toBe(0);
      expect(await rendered.locator('iframe').count()).toBe(0);
      expect(await rendered.locator('svg[onload]').count()).toBe(0);

      // Verify content is entity-encoded, not executed
      expect(innerHtml).toContain('&lt;script&gt;');
      expect(innerHtml).toContain('&lt;iframe');
      expect(innerHtml).toContain('&lt;svg');

      // Verify reasoning box is also escaped
      const thinkingHtml = await page.locator('#flowThinkingContainer').innerHTML();
      expect(thinkingHtml).toContain('&lt;script&gt;');
      expect(await page.locator('#flowThinkingContainer script').count()).toBe(0);
    });

    test('should sanitize event handlers, javascript: and data: URLs', async ({ page }) => {
      await page.route('**/api/ai/proxy**', async (route) => {
        await route.fulfill({
          json: {
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: '<img src="x" onerror="alert(1)"><div onclick="steal()">Click</div>[Dangerous JS](javascript:alert(1))[Data Link](data:text/html,<script>alert(1)</script>)',
                reasoning: ''
              },
              finish_reason: 'stop'
            }],
            usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 }
          }
        });
      });

      await page.fill('#flowRootInput', 'Malicious attributes probe');
      await page.click('#runFlowPipelineBtn');
      await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

      const rendered = page.locator('#flowActiveResultRendered');
      // No live img elements with onerror
      expect(await rendered.locator('img[onerror]').count()).toBe(0);
      // No div with onclick
      expect(await rendered.locator('div[onclick]').count()).toBe(0);

      // Inspect any rendered links
      const links = rendered.locator('a');
      const count = await links.count();
      for (let i = 0; i < count; i++) {
        const href = await links.nth(i).getAttribute('href');
        expect(href).not.toContain('javascript:');
        expect(href).not.toContain('data:text/html');
      }
    });
  });

  test('should handle edge cases: long output, unicode, and Indonesian characters safely', async ({ page }) => {
    const indonesianText = `## Hasil Analisis & Strategi Pertumbuhan

Produk: Pecut AI — Otomatisasi Alur Kerja Cerdas.
Karakteristik & Nilai Tambah:
- Biaya langganan terjangkau: Rp 2.500.000 / bulan.
- Peningkatan efisiensi: 🚀 +350% dalam 30 hari pertama.
- Kutipan pengarah: «Inovasi tanpa batas membutuhkan keandalan sistem tingkat tinggi».
- Karakter multilingual: café, résumé, naïve, über, señor, 100% aman.

${'Paragraf panjang untuk menguji stabilitas render buffer teks besar. '.repeat(50)}
`;

    await page.route('**/api/ai/proxy**', async (route) => {
      await route.fulfill({
        json: {
          choices: [{
            index: 0,
            message: { role: 'assistant', content: indonesianText, reasoning: 'Analisis berbasis data riil.' },
            finish_reason: 'stop'
          }],
          usage: { prompt_tokens: 200, completion_tokens: 500, total_tokens: 700 }
        }
      });
    });

    await page.fill('#flowRootInput', 'Indonesian text and unicode probe');
    await page.click('#runFlowPipelineBtn');
    await expect(page.locator('#telemetryStateBadge')).toHaveText('COMPLETED', { timeout: 30000 });

    const rendered = page.locator('#flowActiveResultRendered');
    await expect(rendered).toContainText('Hasil Analisis & Strategi Pertumbuhan');
    await expect(rendered).toContainText('Rp 2.500.000');
    await expect(rendered).toContainText('🚀 +350%');
    await expect(rendered).toContainText('café, résumé');
  });

  test('should verify viewing output does not trigger additional network requests', async ({ page }) => {
    let extraRequestCount = 0;

    await page.route('**/api/ai/proxy**', async (route) => {
      extraRequestCount++;
      await route.fulfill({ json: {} });
    });

    // Rapidly switch across all tabs
    const tabs = page.locator('#flowResultTabs .comp-tab');
    await tabs.nth(0).click();
    await tabs.nth(1).click();
    await tabs.nth(2).click();
    await tabs.nth(3).click();
    await tabs.nth(0).click();

    // Toggle raw / markdown modes
    await page.click('#btnModeRaw');
    await page.click('#btnModeMarkdown');

    // Inspect history item
    await page.click('#flowRunHistoryList button:has-text("Inspect Output")');

    // Exactly 0 network requests should be triggered by inspecting or switching tabs
    expect(extraRequestCount).toBe(0);

    // Verify credentials never appear in rendered output
    const html = await page.locator('#flowResultsContainer').innerHTML();
    expect(html).not.toContain('test-key-mock-valid-12345');
    expect(html).not.toContain('Bearer');
  });
});
