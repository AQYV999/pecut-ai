/**
 * Pecut AI — Combined Test Fixtures
 * Base test setup with all utilities.
 */

import { test as base } from '@playwright/test';
import { setupProviderMocks, mockResponses, workflowStepResponses, installRequestCounter, resetAIRequestCount, getAIRequestCount } from './provider-mocks.js';
import { clearAllStorage, setupCleanTestState, captureStorageState, verifyNoCredentialLeakage, STORAGE_KEYS, testFixtures } from './storage-helpers.js';

/**
 * Extended test fixture with all utilities
 */
export const test = base.extend({
  // Clean page with request counter installed
  page: async ({ page, baseURL }, use) => {
    // Install request counter on every page
    await installRequestCounter(page);
    await resetAIRequestCount(page);

    await use(page);

    // Verify no credential leakage after test
    const leakage = await verifyNoCredentialLeakage(page);
    if (leakage.leaked) {
      console.error('🚨 [Credential Leakage Detected]', leakage.details);
    }
  },

  // Page with provider mocks configured for success scenario
  mockedPage: async ({ page }, use) => {
    await installRequestCounter(page);
    await resetAIRequestCount(page);
    await setupProviderMocks(page, { scenario: 'success' });
    await use(page);
  },

  // Page with provider mocks configured for failure scenarios
  failingMockedPage: async ({ page }, use) => {
    await installRequestCounter(page);
    await resetAIRequestCount(page);
    await use(page);
  },

  // Access to mock responses
  mockResponses: mockResponses,
  workflowStepResponses: workflowStepResponses,

  // Storage helpers
  storageHelpers: {
    clearAllStorage,
    setupCleanTestState,
    captureStorageState,
    verifyNoCredentialLeakage,
    STORAGE_KEYS,
    testFixtures,
  },

  // Provider mocking utilities
  providerMocks: {
    setupProviderMocks,
    getAIRequestCount,
    resetAIRequestCount,
  },
});

export { expect } from '@playwright/test';