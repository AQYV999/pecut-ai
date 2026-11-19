# E2E Test Plan — Pecut AI

**Version:** 1.0  
**Date:** 2026-11-18  
**Environment:** Local development (http://127.0.0.1:5173)

---

## 1. Scope

Comprehensive End-to-End (E2E) testing of Pecut AI using Playwright, covering all critical user journeys from the Master Prompt requirements.

---

## 2. Test Architecture

### 2.1 Directory Structure

```
e2e/
  fixtures/
    test-fixtures.js          # Extended test fixtures (clean context, auth, provider mocks)
    provider-mocks.js         # Deterministic AI provider mocks (9 scenarios)
    storage-helpers.js        # localStorage isolation & seeding helpers
  specs/
    01-app-smoke.spec.js             # Smoke tests
    02-workflow-builder.spec.js      # Workflow builder CRUD
    03-provider-configuration.spec.js # BYOK, providers, models, context profiles
    04-workflow-execution.spec.js    # Multi-step workflow execution with mocks
    05-cancellation-recovery.spec.js # Cancel, retry, resume scenarios
    06-output-viewer.spec.js         # Output rendering, markdown, security
    07-cross-module-handoff.spec.js  # Canvas, Prompt Builder, Library, Clipboard, Download
    08-execution-history.spec.js     # History persistence, filtering, export
    09-security.spec.js              # API key masking, XSS, CSP, no secrets in logs
    10-responsive-ui.spec.js         # Desktop, Laptop, Tablet, Mobile viewports
```

### 2.2 Playwright Configuration

- **Config:** `playwright.config.js`
- **Projects:** 4 viewports (Desktop 1440×900, Laptop 1366×768, Tablet 768×1024, Mobile 390×844)
- **Web Server:** Auto-starts `npm run dev` (Vite on port 5173)
- **Reporters:** HTML + List
- **Artifacts:** Screenshots on failure, traces on failure, videos on failure
- **Test Isolation:** Each test gets fresh browser context; localStorage cleared via `beforeEach`

---

## 3. Test Scenarios & Coverage

| Suite | Tests | Master Prompt Section | Status |
|-------|-------|----------------------|--------|
| 01-app-smoke | 7 | A. Application Smoke Testing | ✅ Written |
| 02-workflow-builder | 17 | B. Workflow Builder Testing | ✅ Written |
| 03-provider-config | 13 | C. Provider & Context Configuration | ✅ Written (pre-existing) |
| 04-workflow-execution | 9 | D. Multi-Model Workflow Execution | ✅ Written (pre-existing) |
| 05-cancellation-recovery | 12 | E. Cancellation, Retry & Resume | ✅ Written |
| 06-output-viewer | 17 | F. Output Viewer | ✅ Written |
| 07-cross-module-handoff | 12 | G. Cross-Module Handoff | ✅ Written |
| 08-execution-history | 10 | H. Execution History | ✅ Written |
| 09-security | 13 | I. Security Testing | ✅ Written |
| 10-responsive-ui | 11 × 4 viewports | J. Responsive UI Testing | ✅ Written |

**Total:** ~121 test cases × 4 viewports = ~484 test executions

---

## 4. Provider Mocking Strategy

All tests use deterministic mocks via Playwright network interception (`provider-mocks.js`):

| Scenario | Description |
|----------|-------------|
| `success` | Valid AI response with usage metadata |
| `delayed` | 2s delayed response |
| `rate-limit` | HTTP 429 with Retry-After header |
| `auth-error` | HTTP 401 Unauthorized |
| `server-error` | HTTP 500 |
| `network-error` | Connection failure |
| `malformed-json` | Invalid JSON response |
| `empty-response` | 200 OK with empty body |
| `streaming` | SSE streaming chunks |

**Providers Mocked:** OpenRouter, Gemini, OpenAI-compatible, Groq, Ollama/Custom

---

## 5. Test Data Isolation

- Each test: `clearAllStorage()` via `page.addInitScript()` before navigation
- Deterministic test IDs: `test-wf-<suite>-<name>`
- No shared credentials between tests
- Fixtures seeded via `seedTestData()` helper

---

## 6. Execution Commands

```bash
# Install (once)
npm install -D @playwright/test
npx playwright install chromium

# Run all E2E tests
npm run test:e2e

# Run with UI mode
npx playwright test --ui

# Run single suite
npx playwright test e2e/specs/01-app-smoke.spec.js

# Run single viewport
npx playwright test --project=desktop

# View HTML report
npx playwright show-report
```

---

## 7. Quality Gates

| Gate | Command | Must Pass |
|------|---------|-----------|
| Unit tests | `npm test` | ✅ |
| Production build | `npm run build` | ✅ |
| E2E tests | `npm run test:e2e` | Target |

---

## 8. Reporting

| Artifact | Location |
|----------|----------|
| HTML Report | `playwright-report/index.html` |
| Screenshots | `test-results/<test-name>/test-failed-*.png` |
| Traces | `test-results/<test-name>/trace.zip` |
| Videos | `test-results/<test-name>/video.webm` |

---

## 9. Assumptions & Limitations

- Tests run against local Vite dev server (not staging/production)
- No real AI API calls — all intercepted
- IndexedDB persistence tested via localStorage seeding (actual DB ops not fully verified in E2E)
- Mobile testing uses Chromium mobile viewport, not real device
- Firefox/WebKit not configured (Chromium only per Master Prompt primary browser)

---

## 10. Next Steps

1. Fix selector mismatches by inspecting actual DOM
2. Run full test suite to establish baseline
3. Document all failures in E2E_BUG_REPORT.md
4. Iterate until quality gates pass
5. Produce E2E_RELEASE_READINESS.md
