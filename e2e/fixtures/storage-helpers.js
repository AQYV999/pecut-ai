/**
 * Pecut AI — Storage Helpers for E2E Tests
 * Utilities for managing LocalStorage state between tests.
 */

/**
 * Complete LocalStorage keys used by Pecut AI
 */
export const STORAGE_KEYS = {
  // Core app state
  APP_STATE: 'pecut_ai_state',
  SETTINGS: 'pecut_ai_settings',
  BYOK_CONFIG: 'pecut_byok_config',
  PROVIDER_PROFILES: 'pecut_provider_profiles',

  // Module-specific
  FLOWS: 'pecut_flows_v2',
  FLOW_RUNS: 'pecut_flow_runs',
  LIBRARY: 'pecut_library',
  PROFILES: 'pecut_profiles',
  TEMPLATES: 'pecut_templates',
  HISTORY: 'pecut_history',
  WORKSPACES: 'pecut_workspaces',
  CHAT_SESSIONS: 'pecut_chat_sessions',
  ACTIVE_CHAT_SESSION: 'pecut_active_chat_session',

  // UI state
  THEME: 'pecut_theme',
  SIDEBAR_COLLAPSED: 'pecut_sidebar_collapsed',
};

/**
 * Default test fixture data
 */
export const testFixtures = {
  // Minimal valid BYOK config for testing
  minimalBYOK: {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    apiKey: 'test-key-' + 'x'.repeat(32),
    baseUrl: 'https://openrouter.ai/api/v1',
  },

  // Valid provider profiles for keyless providers
  keylessProfiles: {
    ninerouter: {
      apiKey: '',
      baseUrl: 'http://localhost:4000/v1',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
    },
    custom: {
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2:latest',
    },
  },

  // Sample workflow for testing
  sampleFlow: {
    id: 'flow_test_e2e_' + Date.now().toString(36),
    title: 'E2E Test Workflow',
    category: 'Testing',
    description: 'Automated E2E test workflow',
    defaultContextProfileId: '',
    steps: [
      {
        id: 'step_research',
        title: 'Research',
        instruction: 'Research the topic: {{input}}\n\nProvide comprehensive findings.',
        provider: 'inherit',
        model: 'inherit',
        contextProfileId: 'inherit',
        temperature: 0.3,
        maxTokens: 4096,
      },
      {
        id: 'step_analysis',
        title: 'Technical Analysis',
        instruction: 'Analyze the research: {{prev}}\n\nProvide technical specifications.',
        provider: 'inherit',
        model: 'inherit',
        contextProfileId: 'inherit',
        temperature: 0.3,
        maxTokens: 4096,
      },
      {
        id: 'step_review',
        title: 'Critical Review',
        instruction: 'Review the analysis: {{step:step_analysis}}\n\nProvide critical feedback.',
        provider: 'inherit',
        model: 'inherit',
        contextProfileId: 'inherit',
        temperature: 0.3,
        maxTokens: 4096,
      },
    ],
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Sample context profiles
  sampleProfiles: [
    {
      id: 'profile_test_1',
      name: 'Senior Engineer',
      category: 'Engineering',
      role: 'Senior Full-Stack Engineer & Architecture Critic',
      tone: 'Technical & Rigorous',
      context: 'Deep expertise in system design, scalability, and code quality.',
      constraints: ['No fluff', 'Code examples required', 'Architecture-first thinking'],
      isBuiltIn: false,
    },
    {
      id: 'profile_test_2',
      name: 'Technical Writer',
      category: 'Writing',
      role: 'Technical Documentation Specialist',
      tone: 'Professional & Authoritative',
      context: 'Expert in creating clear, structured technical documentation.',
      constraints: ['Clear headings', 'Step-by-step instructions', 'Glossary included'],
      isBuiltIn: false,
    },
  ],

  // Sample library entries
  sampleLibrary: [
    {
      id: 'lib_test_1',
      title: 'Test Prompt 1',
      category: 'Programming',
      content: 'Test prompt content for E2E testing',
      tags: ['test', 'e2e'],
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

/**
 * Clears all Pecut AI LocalStorage data
 * @param {import('@playwright/test').Page} page
 */
export async function clearAllStorage(page) {
  await page.evaluate((keys) => {
    keys.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
  }, Object.values(STORAGE_KEYS));
}

/**
 * Sets up clean test state with minimal required data
 * @param {import('@playwright/test').Page} page
 * @param {Object} overrides - Optional overrides for specific keys
 */
export async function setupCleanTestState(page, overrides = {}) {
  await clearAllStorage(page);

  const defaultState = {
    [STORAGE_KEYS.SETTINGS]: JSON.stringify({
      theme: 'system',
      language: 'id',
      autoSave: true,
      compactMode: false,
    }),
    [STORAGE_KEYS.BYOK_CONFIG]: JSON.stringify(testFixtures.minimalBYOK),
    [STORAGE_KEYS.PROVIDER_PROFILES]: JSON.stringify(testFixtures.keylessProfiles),
    [STORAGE_KEYS.FLOWS]: JSON.stringify([testFixtures.sampleFlow]),
    [STORAGE_KEYS.FLOW_RUNS]: JSON.stringify([]),
    [STORAGE_KEYS.LIBRARY]: JSON.stringify(testFixtures.sampleLibrary),
    [STORAGE_KEYS.PROFILES]: JSON.stringify(testFixtures.sampleProfiles),
    [STORAGE_KEYS.HISTORY]: JSON.stringify([]),
    [STORAGE_KEYS.WORKSPACES]: JSON.stringify([
      { id: 'ws_default', title: 'Default Workspace', content: '', updatedAt: new Date().toISOString() },
    ]),
    [STORAGE_KEYS.CHAT_SESSIONS]: JSON.stringify([]),
    [STORAGE_KEYS.ACTIVE_CHAT_SESSION]: JSON.stringify(null),
    [STORAGE_KEYS.THEME]: 'system',
  };

  // Apply overrides
  const finalState = { ...defaultState, ...overrides };

  await page.evaluate((state) => {
    Object.entries(state).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }, finalState);

  // Reload to apply state
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.app-layout', { timeout: 10000 });
}

/**
 * Captures current LocalStorage state for debugging
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Object>}
 */
export async function captureStorageState(page) {
  return await page.evaluate((keys) => {
    const state = {};
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      try {
        state[key] = value ? JSON.parse(value) : null;
      } catch {
        state[key] = value;
      }
    });
    return state;
  }, Object.values(STORAGE_KEYS));
}

/**
 * Verifies no API keys leaked in storage
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{leaked: boolean, details: string[]}>}
 */
export async function verifyNoCredentialLeakage(page) {
  return await page.evaluate((keys) => {
    const leaked = [];
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        // Check for patterns that look like API keys
        const patterns = [
          /sk-[a-zA-Z0-9]{32,}/,  // OpenAI style
          /Bearer\s+[a-zA-Z0-9\-_]{20,}/,  // Bearer tokens
          /api[_-]?key["\s:=]+[a-zA-Z0-9\-_]{20,}/i,
          /authorization["\s:=]+[a-zA-Z0-9\-_]{20,}/i,
        ];
        patterns.forEach(pattern => {
          if (pattern.test(value)) {
            leaked.push({ key, pattern: pattern.toString() });
          }
        });
      }
    });
    return { leaked: leaked.length > 0, details: leaked };
  }, [
    STORAGE_KEYS.FLOWS,
    STORAGE_KEYS.FLOW_RUNS,
    STORAGE_KEYS.LIBRARY,
    STORAGE_KEYS.HISTORY,
    STORAGE_KEYS.WORKSPACES,
  ]);
}

/**
 * Exports current state as JSON (for test artifacts)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function exportTestState(page) {
  const state = await captureStorageState(page);
  return JSON.stringify(state, null, 2);
}