/**
 * Pecut AI — Application Smoke Tests
 * Verifies basic application loading and navigation.
 */

import { test, expect } from '../fixtures/test-fixtures.js';

test.describe('Application Smoke Tests', () => {
  test('should load application without errors', async ({ page }) => {
    // Navigate to base URL
    await page.goto('/', { waitUntil: 'networkidle' });

    // Verify main layout renders
    await expect(page.locator('.app-layout')).toBeVisible();

    // Verify sidebar navigation
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.sidebar-nav')).toBeVisible();

    // Verify main content area
    await expect(page.locator('.main-wrapper')).toBeVisible();
    await expect(page.locator('#view-overview.active')).toBeVisible();

    // Verify no console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    // Wait a moment for any async errors
    await page.waitForTimeout(1000);

    // Filter out known benign errors (like favicon)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('chrome-extension') &&
      !e.includes('Extension')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should render overview dashboard with metrics', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Verify overview view is active
    await expect(page.locator('#view-overview.active')).toBeVisible();

    // Verify welcome banner
    await expect(page.locator('.welcome-banner')).toBeVisible();
    await expect(page.locator('.welcome-text h2')).toContainText('Welcome back');

    // Verify metric cards
    await expect(page.locator('.metric-card')).toHaveCount(4);

    // Verify quick actions
    await expect(page.locator('.quick-action-item')).toHaveCount(6);
  });

  test('should navigate between all main views', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const views = [
      { nav: 'overview', view: 'view-overview', title: 'Overview' },
      { nav: 'chat', view: 'view-chat', title: 'AI Chat' },
      { nav: 'canvas', view: 'view-canvas', title: 'Workspace Canvas' },
      { nav: 'builder', view: 'view-builder', title: 'Prompt Builder' },
      { nav: 'optimizer', view: 'view-optimizer', title: 'Prompt Optimizer' },
      { nav: 'flow', view: 'view-flow', title: 'Pecut Flow' },
      { nav: 'profiles', view: 'view-profiles', title: 'Context Profiles' },
      { nav: 'library', view: 'view-library', title: 'Prompt Library' },
      { nav: 'templates', view: 'view-templates', title: 'Templates' },
      { nav: 'history', view: 'view-history', title: 'History' },
      { nav: 'settings', view: 'view-settings', title: 'Settings' },
    ];

    for (const { nav, view, title } of views) {
      // Click navigation item
      await page.click(`.nav-item[data-nav="${nav}"]`);

      // Verify view is active
      await expect(page.locator(`#${view}.active`)).toBeVisible({ timeout: 5000 });

      // Verify view title in topbar
      await expect(page.locator('#viewTitle')).toContainText(title);
    }
  });

  test('should have functional mobile navigation toggle', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Mobile toggle should be visible
    await expect(page.locator('#mobileToggle')).toBeVisible();

    // Click to open sidebar
    await page.click('#mobileToggle');
    await expect(page.locator('.sidebar')).toHaveClass(/open/);

    // Click close button
    await page.click('#mobileCloseBtn');
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  });

  test('should capture initial screenshot', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.screenshot({
      path: 'e2e/screenshots/smoke-01-app-loaded.png',
      fullPage: true,
    });
  });
});