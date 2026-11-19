/**
 * Pecut AI — Global E2E Test Setup
 * Runs once before all test suites.
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalSetup() {
  console.log('🔧 [Global Setup] Starting E2E test environment preparation...');

  // Ensure artifact directories exist
  const dirs = ['playwright-report', 'test-results', 'e2e/screenshots'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Launch a browser to verify the application loads
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const baseURL = process.env.BASE_URL || 'http://localhost:5175';

  try {
    console.log(`🔧 [Global Setup] Verifying application at ${baseURL}...`);
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for the main app to be ready
    await page.waitForSelector('.app-layout', { timeout: 30000 });
    await page.waitForSelector('#view-overview.active', { timeout: 10000 });

    console.log('🔧 [Global Setup] Application loaded successfully');

    // Capture initial screenshot
    await page.screenshot({ path: 'e2e/screenshots/00-app-loaded.png', fullPage: true });
    console.log('🔧 [Global Setup] Initial screenshot captured');
  } catch (error) {
    console.error('🔧 [Global Setup] Failed to load application:', error.message);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('🔧 [Global Setup] Complete');
}

export default globalSetup;