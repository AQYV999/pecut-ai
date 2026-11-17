# Multi-Provider BYOK & Vercel Universal Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Pecut AI into a public, zero-cost, multi-provider BYOK web application ready for Vercel deployment with support for OpenRouter, Google Gemini, Groq, OpenAI, and local models.

**Architecture:** A unified client AI service (`src/services/ai/client.js`) dispatches requests across a 3-tier cascade (Client BYOK -> Server .env -> Local Mock). Cloud provider requests pass through a zero-storage Vercel serverless proxy (`api/ai/proxy.js`) with domain allowlist security to eliminate browser CORS, while local origins (`localhost`) are reached directly by the browser.

**Tech Stack:** Vanilla JavaScript ES Modules, Vite, Native Node.js (Vercel Serverless Function & self-hosted server), CSS variables.

**Spec:** `docs/superpowers/specs/2026-11-17-multi-provider-byok-vercel-design.md`

## Global Constraints
- Must maintain Vanilla JS ES Modules + Vite stack with zero heavy client frameworks.
- Zero secrets or API keys stored on server disk or persistent cloud databases; client keys live exclusively in `localStorage` (`pecut_byok_config`).
- All cloud provider interactions use standard OpenAI chat completion schemas (`/v1/chat/completions`) without custom proprietary translation bloat.
- Offline and unconfigured states must gracefully fall back to deterministic local mock without throwing uncaught exceptions.
- Backward compatibility: existing unit tests in `tests/` must remain passing.

## Review Focus
1. **SSRF / Open Proxy attempt via `/api/ai/proxy`:** When `x-target-url` targets an untrusted or internal host (e.g., `http://169.254.169.254`), proxy returns HTTP 403 Forbidden.
2. **Missing or empty Authorization header:** When client calls `/api/ai/proxy` without an API key, proxy returns HTTP 400 Bad Request.
3. **Localhost URL routing:** When provider Base URL is `http://localhost:11434`, client dispatches directly to localhost instead of `/api/ai/proxy`.
4. **Vercel execution timeout resilience:** Upstream request timeout is enforced at 12 seconds to prevent Vercel 504 function invocation timeouts.
5. **No-key fallback cascade:** When no API key is provided and server has no `.env`, calls to optimizer and flow cleanly produce local structural output.

---

### Task 1: BYOK Storage & Provider Presets Data Layer

**Files:**
- Create: `src/data/models.js`
- Modify: `src/modules/storage.js`
- Test: `tests/byokStorage.test.js`

**Interfaces:**
- Consumes: `localStorage`
- Produces: 
  - `PROVIDER_PRESETS`: Object containing configurations for `openrouter`, `gemini`, `groq`, `openai`, `custom`.
  - `loadBYOKConfig()`: Returns `{ provider, apiKey, model, baseUrl }`.
  - `saveBYOKConfig(config)`: Persists valid config to `pecut_byok_config`.
  - `clearBYOKConfig()`: Removes `pecut_byok_config`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/byokStorage.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const storageStore = new Map();
globalThis.localStorage = {
  getItem: (key) => storageStore.get(key) || null,
  setItem: (key, val) => storageStore.set(key, String(val)),
  removeItem: (key) => storageStore.delete(key),
  clear: () => storageStore.clear()
};

const { loadBYOKConfig, saveBYOKConfig, clearBYOKConfig } = await import('../src/modules/storage.js');
const { PROVIDER_PRESETS } = await import('../src/data/models.js');

test('PROVIDER_PRESETS contains openrouter, gemini, groq, openai, and custom', () => {
  assert.ok(PROVIDER_PRESETS.openrouter);
  assert.ok(PROVIDER_PRESETS.gemini);
  assert.ok(PROVIDER_PRESETS.groq);
  assert.ok(PROVIDER_PRESETS.openai);
  assert.ok(PROVIDER_PRESETS.custom);
  assert.equal(PROVIDER_PRESETS.openrouter.defaultModel, 'meta-llama/llama-3.3-70b-instruct:free');
});

test('loadBYOKConfig returns default openrouter preset when storage is empty', () => {
  storageStore.clear();
  const config = loadBYOKConfig();
  assert.equal(config.provider, 'openrouter');
  assert.equal(config.apiKey, '');
  assert.equal(config.model, 'meta-llama/llama-3.3-70b-instruct:free');
});

test('saveBYOKConfig and clearBYOKConfig manage pecut_byok_config properly', () => {
  storageStore.clear();
  saveBYOKConfig({
    provider: 'gemini',
    apiKey: 'AIzaSyTest123',
    model: 'gemini-1.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  });

  const loaded = loadBYOKConfig();
  assert.equal(loaded.provider, 'gemini');
  assert.equal(loaded.apiKey, 'AIzaSyTest123');

  clearBYOKConfig();
  assert.equal(loadBYOKConfig().apiKey, '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/byokStorage.test.js`
Expected: FAIL (modules not found / functions not exported)

- [ ] **Step 3: Implement `src/data/models.js` and extend `src/modules/storage.js`**

Create `src/data/models.js` with presets and add `loadBYOKConfig`, `saveBYOKConfig`, `clearBYOKConfig` in `src/modules/storage.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/byokStorage.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/models.js src/modules/storage.js tests/byokStorage.test.js
git commit -m "feat: add BYOK provider presets and storage persistence"
```

---

### Task 2: Universal Serverless Proxy Endpoint (`api/ai/proxy.js`) & Local Server Parity

**Files:**
- Create: `api/ai/proxy.js`
- Create: `vercel.json`
- Modify: `server/index.js`
- Test: `tests/proxy.test.js`

**Interfaces:**
- Consumes: HTTP POST request with `x-target-url`, `Authorization`, and OpenAI-compatible JSON body.
- Produces: JSON response from upstream provider or HTTP error status (400, 403, 504).
- Exported helper in `api/ai/proxy.js`: `handleProxyRequest(req, res)` and `ALLOWED_DOMAINS`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/proxy.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_DOMAINS, isUrlAllowed } from '../api/ai/proxy.js';

test('isUrlAllowed only permits whitelisted AI provider domains', () => {
  assert.equal(isUrlAllowed('https://openrouter.ai/api/v1/chat/completions'), true);
  assert.equal(isUrlAllowed('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'), true);
  assert.equal(isUrlAllowed('https://api.groq.com/openai/v1/chat/completions'), true);
  assert.equal(isUrlAllowed('https://api.openai.com/v1/chat/completions'), true);

  // Reject SSRF attempts
  assert.equal(isUrlAllowed('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isUrlAllowed('http://localhost:3000/api/ai/status'), false);
  assert.equal(isUrlAllowed('https://evil-attacker.com/proxy'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/proxy.test.js`
Expected: FAIL (`api/ai/proxy.js` not found)

- [ ] **Step 3: Implement `api/ai/proxy.js`, `vercel.json`, and mirror in `server/index.js`**

Implement `api/ai/proxy.js` with `ALLOWED_DOMAINS`, URL validation, header relay (`Authorization`), 12-second timeout via `AbortSignal.timeout(12000)`, and export for Vercel Serverless Function (`export default async function handler(req, res)`).
Mount `/api/ai/proxy` inside `server/index.js` for local development parity.
Create `vercel.json` configuring rewrites and clean routing.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/proxy.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/ai/proxy.js vercel.json server/index.js tests/proxy.test.js
git commit -m "feat: add universal serverless AI proxy with SSRF protection"
```

---

### Task 3: Unified Client AI Service (`src/services/ai/client.js`)

**Files:**
- Create: `src/services/ai/client.js`
- Modify: `src/services/ai/index.js`
- Test: `tests/aiClient.test.js`

**Interfaces:**
- Consumes: `loadBYOKConfig()` from `src/modules/storage.js`, `PROVIDER_PRESETS` from `src/data/models.js`.
- Produces:
  - `completeChat({ messages, systemPrompt, temperature, maxTokens })`: Promise resolving to completion text.
  - `optimizePromptWithAI(rawPrompt, goals)`: Promise resolving to `{ optimizedPrompt, analysis, improvements, mode }`.
  - `executeFlowStep(stepData)`: Promise resolving to `{ output, mode, stepIndex, stepTitle }`.
  - `testAIConnection(config)`: Promise resolving to `{ success: boolean, message: string }`.
  - `isLocalOrigin(url)`: boolean checking for `localhost` or `127.0.0.1`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/aiClient.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLocalOrigin, buildChatPayload } from '../src/services/ai/client.js';

test('isLocalOrigin correctly detects localhost and 127.0.0.1', () => {
  assert.equal(isLocalOrigin('http://localhost:11434/v1'), true);
  assert.equal(isLocalOrigin('http://127.0.0.1:8000/v1'), true);
  assert.equal(isLocalOrigin('https://openrouter.ai/api/v1'), false);
  assert.equal(isLocalOrigin('https://api.openai.com/v1'), false);
});

test('buildChatPayload formats systemPrompt and messages into OpenAI format', () => {
  const payload = buildChatPayload({
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    systemPrompt: 'You are Pecut AI.',
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 0.3,
    maxTokens: 1000
  });

  assert.equal(payload.model, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(payload.messages[0].role, 'system');
  assert.equal(payload.messages[0].content, 'You are Pecut AI.');
  assert.equal(payload.messages[1].role, 'user');
  assert.equal(payload.messages[1].content, 'Hello');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/aiClient.test.js`
Expected: FAIL (`src/services/ai/client.js` not found)

- [ ] **Step 3: Implement `src/services/ai/client.js` and re-export in `src/services/ai/index.js`**

Implement `src/services/ai/client.js` with resolution cascade, local vs cloud URL detection, `testAIConnection`, `completeChat`, `optimizePromptWithAI`, and `executeFlowStep`.
Re-export methods in `src/services/ai/index.js` for zero disruption to existing callers.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/aiClient.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ai/client.js src/services/ai/index.js tests/aiClient.test.js
git commit -m "feat: implement unified client AI service with resolution cascade"
```

---

### Task 4: AI Connection Modal & UI Integration

**Files:**
- Create: `src/modules/aiModal.js`
- Modify: `index.html`
- Modify: `style.css`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `loadBYOKConfig`, `saveBYOKConfig`, `clearBYOKConfig` from `storage.js`; `PROVIDER_PRESETS` from `models.js`; `testAIConnection` from `client.js`.
- Produces: `initAIModal()`, `openAIModal()`, `closeAIModal()`, `updateTopbarAIStatus()`.

- [ ] **Step 1: Add HTML modal structure in `index.html`**

Add `#aiConnectionModal` before closing body tag with:
- Provider select `#byokProviderSelect`
- Base URL input `#byokBaseUrlInput`
- API Key input `#byokApiKeyInput` with show/hide eye toggle button `#byokToggleKeyBtn`
- Model quick-pick buttons container `#byokModelPresets` and model input `#byokModelInput`
- Test Connection button `#byokTestBtn` with status container `#byokTestStatus`
- Save button `#byokSaveBtn` and Clear button `#byokClearBtn`
- Make topbar `.api-status-badge` clickable with pointer cursor and title "Configure AI Provider".

- [ ] **Step 2: Add CSS rules for Connection Modal in `style.css`**

Add modal overlay, provider badge styling, quick-select model pills with `.pill-free` highlight, test status animations, and responsive adjustments.

- [ ] **Step 3: Implement `src/modules/aiModal.js`**

Implement modal state synchronization, dynamic model preset loading upon provider switch, test connection button handling, saving/clearing to `localStorage`, and updating `#apiStatusText` on topbar.

- [ ] **Step 4: Connect `initAIModal` in `src/main.js`**

Wire `initAIModal()` in `DOMContentLoaded` lifecycle and attach click listener on `#apiStatusBadge` to open modal.

- [ ] **Step 5: Verify build and test suite**

Run: `npm test && npm run build`
Expected: All tests pass and Vite builds cleanly without bundle warnings.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css src/modules/aiModal.js src/main.js
git commit -m "feat: add interactive AI Connection modal with multi-provider presets"
```

---

### Task 5: Connect Optimizer & Flow to Unified Client + Verification

**Files:**
- Modify: `src/modules/optimizer.js`
- Modify: `src/modules/flow.js`
- Modify: `README.md`
- Test: All tests in `tests/**/*.test.js`

**Interfaces:**
- Consumes: `optimizePromptWithAI` and `executeFlowStep` from `src/services/ai/client.js`.
- Produces: End-to-end prompt optimization and flow execution powered by user's chosen BYOK provider.

- [ ] **Step 1: Verify `src/modules/optimizer.js` handles BYOK results**

Ensure `optimizer.js` displays the active provider name (e.g. "Optimized via OpenRouter (llama-3.3-70b)") in the comparison report.

- [ ] **Step 2: Verify `src/modules/flow.js` handles BYOK step execution**

Ensure `flow.js` renders live AI output per step with model attribution.

- [ ] **Step 3: Update `README.md`**

Add section detailing Vercel 1-Click Deployment and BYOK Multi-Provider setup (OpenRouter, Gemini, Groq, OpenAI).

- [ ] **Step 4: Run full verification suite**

Run: `npm test`
Expected: All tests across storage, proxy, client, templates, and flows pass.
Run: `npm run build`
Expected: Production build in `dist/` succeeds in <1s.

- [ ] **Step 5: Commit**

```bash
git add src/modules/optimizer.js src/modules/flow.js README.md
git commit -m "feat: integrate BYOK engine into optimizer and flow, update documentation"
```
