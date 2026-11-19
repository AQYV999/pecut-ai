# Pecut AI 1.9 — Closed Beta Readiness Report

**Date:** November 20, 2026  
**Target Milestone:** Closed Beta Launch Readiness  
**Staging URL:** `https://pecut-ai-git-staging-pecut-ai-19-kel-4.vercel.app`  
**Deployment ID:** `dpl_A3Uiy3NYPTYnN6t2PEYV4UBFsEPW`  
**Git Branch:** `staging/pecut-ai-1.9` (Commit: `1f16199`)  
**Production Domain (Untouched):** `https://pecut-ei0nib0nd-kel-4.vercel.app`  
**Beta Decision:** **CONDITIONAL GO (Pending Rate Limit Approval & User BYOK Verification)** 🟡 ➔ 🟢

---

## 1. Reconciled E2E Test Counts & Discrepancy Resolution

### 1.1. Exact Spec-by-Spec Test Census
Inspection of the actual Playwright execution test artifacts (`test-results/results.json`) and the test specification files in `e2e/specs/` yields the following exact census:

| Suite Identifier | Spec File Name | Test Count | Status | Notes |
| :--- | :--- | :---: | :---: | :--- |
| **Suite 01** | `01-app-smoke.spec.js` | **5** | Passed | App load, routing, dashboard metrics, mobile drawer, baseline screenshot |
| **Suite 02** | `02-workflow-builder.spec.js` | **17** | Passed (1 flaky) | Step CRUD, duplicate, reordering (flaky passed on retry #1 in 7.1s), variable chips, persistence |
| **Suite 03** | `03-provider-configuration.spec.js` | **18** | Passed | Multi-provider BYOK, overrides, context profiles, bounds validation, keyless providers |
| **Suite 04** | `04-workflow-execution.spec.js` | **18** | Passed | 3-step sequential flow, interpolation, progress/timer telemetry, token metrics, error handlers |
| **Suite 05** | `05-cancellation-recovery.spec.js` | **18** | Passed | In-flight cancellation, AbortSignal transport, partial output retention, retry, resume |
| **Suite 06** | `06-output-viewer.spec.js` | **18** | Passed | Per-step/consolidated tabs, markdown rendering, raw toggle, copy buttons, reasoning, XSS |
| **Suite 07** | `07-cross-module-handoff.spec.js` | **21** | Passed | Canvas dispatch (append/overwrite), Prompt Builder, Library, file downloads, clipboard |
| **Suite 08** | `08-execution-history.spec.js` | **23** | Passed | History badges, inspect output, immutability, FIFO pruning (20 runs), output & storage caps |
| **Suite 09** | `09-security.spec.js` | **38** | Passed | Credential hygiene, XSS, malicious JSON import, iframe sandbox, anti-SSRF, network safety |
| **Suite 10** | `10-responsive-ui.spec.js` | **41** | Passed | Desktop (10), Laptop (10), Tablet (10), Mobile (10), and Cross-Viewport Resizing (1) |
| **TOTAL** | **10 Spec Files** | **217** | **100% PASS** | **Mathematical Sum: 5+17+18+18+18+18+21+23+38+41 = 217** |

### 1.2. Aggregate Results Breakdown
- **Total Specs Executed:** 217
- **Passed (Attempt 1):** 216
- **Flaky (Passed on Retry 1):** 1 (`02-workflow-builder.spec.js:167:3 should move steps up and down` — resolved in 7.1s)
- **Failed:** 0
- **Skipped:** 0
- **Total Passing:** **217 / 217 (100.0%)**

### 1.3. Explanation of the Previous 22-Test Discrepancy
In the initial `STAGING_E2E_REPORT.md` narrative draft, an inadvertent transcription error occurred where sub-section test counts were recorded rather than total spec counts:
1. **Suite 06:** Written as 19 (actual is **18**).
2. **Suite 07:** Written as 19 (actual is **21**; omitted Section 5 clipboard error handling and Section 6 immutability verification).
3. **Suite 08:** Written as 21 (actual is **23**; omitted Section 6 credential sanitization in historical snapshots and metadata).
4. **Suite 09:** Written as 28 (actual is **38**; omitted 10 tests across Sections 3 [prototype pollution, malicious IDs], 5 [proxy boundaries], and 7 [storage corruption auto-healing]).
5. **Suite 10:** Written as 32 (actual is **41**; previously counted only 8 basic assertions across 4 viewports [32], omitting modal interactions, action visibility, and cross-viewport resize state persistence).

`E2E_TEST_REPORT.md` already contained the accurate specification counts (217 total). `STAGING_E2E_REPORT.md` has now been edited and reconciled to reflect the exact 217 test count.

---

## 2. Real Provider BYOK Smoke Test Protocol

To protect user credentials, live validation with a real provider must be executed directly by the user within their browser. The assistant must never request, log, or handle the user's live API key.

### Recommended Provider for Zero-Cost Verification
- **Provider:** OpenRouter
- **Model:** `meta-llama/llama-3.3-70b-instruct:free` (100% Free Tier, zero balance required)
- *Alternative:* Google Gemini (`gemini-2.0-flash` or `gemini-1.5-flash` Free Tier)

### Step-by-Step Controlled Verification Checklist

```
[ ] 1. Authenticate to Staging
    - Open https://pecut-ai-git-staging-pecut-ai-19-kel-4.vercel.app in an incognito/clean browser.
    - Authenticate via Vercel Deployment Protection.

[ ] 2. Provider Configuration & Test Connection
    - Navigate to Settings (left sidebar).
    - Under Provider, select "OpenRouter".
    - Model: "meta-llama/llama-3.3-70b-instruct:free".
    - Base URL: "https://openrouter.ai/api/v1".
    - Paste your user-owned OpenRouter API key.
    - Click "Test Connection".
    -> Expected: Green alert "Connection Successful: Connection to OpenRouter verified successfully."

[ ] 3. Single AI Request & Token Accumulation
    - Navigate to Prompt Builder.
    - Enter a short objective: "Explain recursion in one sentence."
    - Click "Optimize / Generate".
    -> Expected: Real-time generation completes. Output shows clear definition. Token metrics increment.

[ ] 4. Multi-Step Workflow Pipeline Execution
    - Navigate to Pecut Flow -> "Run Pipeline".
    - Select "Content Ideation & Outline Pipeline" (3 steps).
    - Objective: "Architecting Resilient Serverless AI Proxies in 2026".
    - Click "Run Pipeline".
    -> Expected:
       * Step 1 (Research) runs; status badge shows IN_PROGRESS; progress bar updates to 33%.
       * Step 2 (Structure) executes using Step 1 output; progress updates to 66%.
       * Step 3 (Review) completes; progress reaches 100%; status badge shows COMPLETED.
       * Output Viewer renders structured Markdown with syntax-highlighted code blocks.
       * Total token count and duration are updated in telemetry.

[ ] 5. Live In-Flight Request Cancellation
    - Click "Run Pipeline" again with a new prompt.
    - While Step 1 is actively generating, click the red "Cancel" button.
    -> Expected:
       * Request terminates immediately via transport AbortSignal.
       * Status badge updates to CANCELLED.
       * Telemetry freezes timer; "Resume Pipeline" button becomes visible.

[ ] 6. Negative Authentication Error Handling (No Silent Fallback)
    - Go to Settings, temporarily modify your API key by appending "INVALID".
    - Return to Pecut Flow and click "Run Pipeline".
    -> Expected:
       * Pipeline stops at Step 1 with a prominent error banner: "HTTP 401: Authentication error".
       * The system does NOT fall back to fake mock responses silently.

[ ] 7. Credential Protection Audit
    - In Pecut Flow, click "Export Workflow" -> Download JSON.
    - Open the downloaded .json file in a text editor.
    -> Expected: "apiKey", "credentials", and raw tokens are completely absent.
```

---

## 3. Proxy Rate Limiting Verification

### 3.1. Actual Configuration Evidence
Verification was performed using the Vercel CLI (`vercel firewall status` and `vercel firewall rules list` against project `prj_laFwdu8v6bclC2eHXRvPa9dDyVvh`):

```
▲ vercel firewall status
  Firewall        Not configured
  Bypass          Requires Pro or Enterprise
  Mitigations     Active (System DDoS Protection)
  Attack Mode     Off
  Bot Protection  Off
  AI Bots         Allow
  OWASP           Off

▲ vercel firewall rules list
  Managed
    Bot Protection   Off      bot-protection
    AI Bots          Allow    ai-bots
    BotID            Basic    bot-id
  Custom
    No custom rules configured.
```

### 3.2. Rate Limiting Status Determination
- **Platform-Level Rate Limiting:** **NOT ACTIVE**. No custom Vercel WAF rule or rate-limiting policy is currently configured for `/api/ai/proxy`.
- **Managed Platform Mitigations:** Automatic DDoS mitigations and layer 4/7 volumetric flood mitigations are **ACTIVE** (standard Vercel edge infrastructure).
- **Application-Level Boundaries:**
  - Payload Size Limit: **ACTIVE** (`MAX_PROXY_BODY_BYTES = 2MB`, validated via header inspection and chunked stream termination).
  - Timeout Enforcement: **ACTIVE** (Internal 55-second `AbortController` timeout budget, bounded inside Vercel's 60-second serverless execution limit).
  - Anti-SSRF Destination Allowlist: **ACTIVE** (Strict domain whitelist; loopback, link-local, and cloud metadata blocked).

### 3.3. Recommended Platform Rate Limiting Policy (Pending Approval)
To prevent API abuse during Closed Beta, the following custom Vercel Firewall rule is recommended:

```json
{
  "name": "Rate limit AI proxy endpoint",
  "description": "Throttles excessive calls to /api/ai/proxy to prevent proxy abuse and upstream exhaustion",
  "active": true,
  "condition": {
    "type": "and",
    "children": [
      {
        "op": "eq",
        "key": "path",
        "value": "/api/ai/proxy"
      }
    ]
  },
  "action": {
    "mitigate": {
      "action": "rate_limit",
      "rate_limit": {
        "algo": "fixed_window",
        "window": 60,
        "limit": 60,
        "keys": ["ip"],
        "action": "deny"
      }
    }
  }
}
```

* **Request Threshold:** 60 requests per minute per IP address.
* **Time Window:** 60 seconds (rolling fixed window).
* **Behavior when Exceeded:** Immediate `HTTP 429 Too Many Requests` returned at the Vercel Edge layer before invoking the serverless function.
* **Status:** **Staged as a recommendation. No changes applied without explicit user authorization.**

---

## 4. Closed Beta Access Plan (Vercel Deployment Protection)

### 4.1. Access Architecture Overview
Vercel Deployment Protection is active (`ssoProtection: { deploymentType: 'all_except_custom_domains' }`). Beta testers must not be given team dashboard access or direct production credentials. Instead, external access is provisioned securely using **Vercel Shareable Links**.

### 4.2. How to Create Shareable Links
1. Navigate to **Vercel Dashboard** -> Project: **Pecut AI** -> **Settings** -> **Deployment Protection**.
2. Locate the **Shareable Links** section.
3. Click **"Generate Link"** (or specify an expiration window, e.g., 14 days or 30 days).
4. Vercel generates a unique URL containing a secure cryptographic share token:
   `https://pecut-ai-git-staging-pecut-ai-19-kel-4.vercel.app/?_vercel_share=<secure-token>`

### 4.3. Access Limitations & Mechanics
- **Cookie Authentication:** When a beta tester opens the shareable link once, Vercel sets an HTTP-only authentication cookie (`_vercel_jwt`) in their browser. Subsequent navigations throughout the session work seamlessly without re-prompting.
- **Strictly Scoped Privileges:** The shareable link grants view and runtime execution rights to the web application only. Testers **cannot** view environment variables, access server logs, inspect Vercel project settings, or modify deployments.
- **Zero Account Requirement:** External testers do not need to create or link a Vercel account.

### 4.4. Revocation Procedure
If a link is compromised or the Closed Beta testing phase concludes:
1. Navigate to **Project Settings** -> **Deployment Protection** -> **Shareable Links**.
2. Locate the active share link and click **"Revoke"**.
3. *Effect:* The shared token is instantly invalidated at Vercel's edge network. All subsequent requests without an active team session or valid bypass token will immediately receive `HTTP 401 Unauthorized`.

### 4.5. Arrangement for 10–15 Beta Testers
- **Single Cohort Link with Expiration:** Generate one Shareable Link configured with a 14-day expiration window. Distribute this link exclusively to the approved 10–15 beta testers via direct communication.
- **Telemetry Monitoring:** Monitor Vercel Function invocations and edge request volume via the Vercel CLI (`npx vercel logs` / `npx vercel metrics`) during testing sessions.

---

## 5. Final Regression Verification

Pre-release regression checks were executed immediately prior to report compilation:

```
> pecut-ai@0.1.0 test
> node --test tests/**/*.test.js

ℹ tests 128
ℹ suites 0
ℹ pass 128
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 5404.252

> pecut-ai@0.1.0 build
> vite build

✓ 45 modules transformed.
dist/index.html                  75.98 kB │ gzip: 13.79 kB
dist/assets/index-BnoFDom4.css   48.44 kB │ gzip:  8.28 kB
dist/assets/index-E3N3A8hN.js   167.11 kB │ gzip: 49.80 kB │ map: 468.05 kB
✓ built in 1.17s
```

- **Unit Test Regression:** **128 / 128 Passed (0 regressions)**
- **Production Build:** **Clean bundle generated in 1.17s**
- **Git Tree:** Working tree clean; branch `staging/pecut-ai-1.9` pushed to `origin`.

---

## 6. Final Closed Beta Recommendation

### Verdict: **CONDITIONAL GO** 🟡 ➔ 🟢

**Conditions to proceed with Closed Beta distribution:**
1. **User BYOK Verification:** The human operator executes the zero-cost smoke test protocol in Section 2 with their personal free-tier key.
2. **Rate Limiting Decision:** The human operator approves or defers staging the platform rate limiting rule in Section 3.3.
3. **Link Generation:** The human operator generates the Vercel Shareable Link in Section 4.2 for tester onboarding.

**Safety Assurance:**
- Production deployment (`https://pecut-ei0nib0nd-kel-4.vercel.app`) remains 100% untouched and isolated.
- Branch `main` has not been merged or touched.
- All testing occurred exclusively on `staging/pecut-ai-1.9` under active Vercel Deployment Protection.
- Execution is now stopped awaiting your explicit authorization.
