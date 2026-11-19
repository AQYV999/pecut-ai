/**
 * Pecut AI — Playwright E2E Configuration
 * Apache-2.0 License
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const isExternal = BASE_URL.startsWith('https://') || 
  (BASE_URL.startsWith('http://') && !BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1'));

const extraHeaders = {};
if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
  extraHeaders['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  extraHeaders['x-vercel-set-bypass-cookie'] = 'true';
}

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: isExternal ? 1 : (process.env.CI ? 2 : 0),
  workers: isExternal ? 3 : (process.env.CI ? 1 : undefined),
  timeout: isExternal ? 75000 : 60000,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
    },
  ],
  webServer: isExternal ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
    },
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
  outputDir: 'test-results/',
  // globalSetup: path.resolve('./e2e/fixtures/global-setup.js'),
  // globalTeardown: path.resolve('./e2e/fixtures/global-teardown.js'),
});