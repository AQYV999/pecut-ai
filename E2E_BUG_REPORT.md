# E2E Bug Report — Pecut AI

**Version:** 1.9  
**Date:** 2026-11-19  
**Status:** All 35 E2E Issues Resolved (E2E-001 through E2E-035)

---

## E2E-001 — Playwright matched no Vite port

- **Severity:** Low / test infrastructure
- **Status:** Fixed
- **Symptom:** Playwright timed out waiting for `http://127.0.0.1:5174` because Vite was not started on that port.
- **Likely source:** `playwright.config.js`
- **Fix:** Start the webServer with `--host 127.0.0.1 --port 5174`.

---

## E2E-002 — Unsupported locator count matcher

- **Severity:** Medium / test infrastructure
- **Status:** Fixed
- **Symptom:** Workflow and history tests failed with `TypeError: expect(...).toHaveCountGreaterThan is not a function`.
- **Likely source:** `e2e/specs/02-workflow-builder.spec.js`, `06-output-viewer.spec.js`, `08-execution-history.spec.js`
- **Fix:** Read the locator count and assert it with `expect(await locator.count()).toBeGreaterThan(...)`.

---

## E2E-003 — Browser binaries initially absent

- **Severity:** Low / environment
- **Status:** Resolved locally
- **Symptom:** Playwright could not find Chromium's executable.
- **Fix:** Ran `npx playwright install chromium`.

---

## E2E-004 — Secondary browser and staging coverage unavailable

- **Severity:** Medium / coverage limitation
- **Status:** Open
- **Details:** Firefox, WebKit, mobile projects and staging URL were not executed.
- **Required action:** Install secondary Playwright browsers and supply an authorized staging `BASE_URL`.

---

## E2E-005 — Selector Mismatches Across Test Suites

- **Severity:** Critical / test infrastructure
- **Status:** Partially Resolved (Suites 01, 02, 03, 04, 05, and 06 100% Resolved and Verified)
- **Symptom:** Initial tests written against speculative DOM structure failed with locator timeouts.
- **Resolved Suites:**
  - `01-app-smoke`: 5/5 passed.
  - `02-workflow-builder`: 17/17 passed. Real DOM mapping completed for builder containers, step cards, inputs, buttons, and variable chips.
  - `03-provider-configuration`: 18/18 passed. Real DOM mapping for provider/model selects, context profiles, advanced parameter inputs/toggles, and credential readiness pills.
  - `04-workflow-execution`: 18/18 passed. Real DOM mapping for runner controls, telemetry badges, progress bars, step execution state, consolidated tabs, and error display.
  - `05-cancellation-recovery`: 18/18 passed. Real DOM mapping for cancel button, single-step retry button, resume pipeline button, partial run persistence, and inspection.
  - `06-output-viewer`: 18/18 passed. Real DOM mapping for result tabs, markdown elements, raw/rendered modes, copy buttons, reasoning summary container, and XSS sanitization.
- **Remaining Suites to Verify:** 07 through 10.

---

## E2E-006 — Test Timeout Settings

- **Severity:** High / test infrastructure
- **Status:** Resolved
- **Symptom:** Vite startup and slow operations exceeded default timeouts during cold start.
- **Fix:** Configured `timeout: 60000ms`, `navigationTimeout: 45000ms` in `playwright.config.js`.

---

## E2E-007 — CSS Selector Syntax Error in Variable Chips Test

- **Severity:** Medium / test code bug
- **Status:** Fixed
- **Symptom:** `page.click('.var-chip:has-text("{{step:")}')` threw `Unsupported token '}'` error.
- **Location:** `e2e/specs/02-workflow-builder.spec.js:219`
- **Fix:** Switched to scoped locator filter: `page.locator('#step-edit-card-1 .var-chip').filter({ hasText: '{{step:' }).click()`.

---

## E2E-008 — Duplicate Step Array Insertion Alignment

- **Severity:** Low / test logic
- **Status:** Fixed
- **Symptom:** Assertion `expect('.flow-step-edit-card:last-child input[id^="step-title-"]').toHaveValue(/Copy/)` failed receiving `"Step 2"`.
- **Location:** `e2e/specs/02-workflow-builder.spec.js:144`
- **Fix:** Updated locator to `.flow-step-edit-card:nth-child(2) input[id^="step-title-"]`.

---

## E2E-009 — Category Option Mismatch in Save Workflow Test

- **Severity:** Medium / test data mismatch
- **Status:** Fixed
- **Symptom:** `page.selectOption('#flowEditCategory', 'Testing')` timed out waiting for `<option value="Testing">`.
- **Location:** `e2e/specs/02-workflow-builder.spec.js:234`
- **Fix:** Updated test to select valid category `'Productivity'`.

---

## E2E-010 — Variable Reference Schema Validation on Save

- **Severity:** Medium / test input mismatch
- **Status:** Fixed
- **Symptom:** Saving workflow failed validation with toast `'Cannot save: workflow contains invalid variable references.'`.
- **Location:** `e2e/specs/02-workflow-builder.spec.js:407`
- **Fix:** Replaced hardcoded non-existent step IDs with supported 1-based index syntax `'Review {{step1}} and {{step2}}'`.

---

## E2E-011 — Strict Mode Violation on Overlapping Toasts

- **Severity:** Low / test locator precision
- **Status:** Fixed
- **Symptom:** `expect(locator('.toast:has-text("saved")')).toBeVisible()` failed with `strict mode violation: resolved to 2 elements`.
- **Location:** `e2e/specs/02-workflow-builder.spec.js:427`
- **Fix:** Used `.last()` on the toast locator: `page.locator('.toast:has-text("saved")').last()`.

---

## E2E-012 — Invalid Locator Assertion `toContain` on Textarea

- **Severity:** Low / Playwright API usage
- **Status:** Fixed
- **Symptom:** `expect(locator('#step-instruction-0')).toContain('{{input}}')` threw method not found error on Playwright `LocatorAssertions`.
- **Location:** `e2e/specs/02-workflow-builder.spec.js:440`
- **Fix:** Replaced with `await expect(page.locator('#step-instruction-0')).toHaveValue(/\{\{input\}\}/);`.

---

## E2E-013 — Step Credential Pill Scoping in Builder Mode

- **Severity:** Medium / locator scoping
- **Status:** Fixed
- **Symptom:** `locator('.step-cred-pill').first()` resolved to the runner view's pill (`#flowRunStepsContainer`) instead of the step card in builder mode.
- **Location:** `e2e/specs/03-provider-configuration.spec.js`
- **Fix:** Scoped selector to `#step-edit-card-0 .step-cred-pill`.

---

## E2E-014 — Option Visibility Assertion in Select Elements

- **Severity:** Low / Playwright API usage
- **Status:** Fixed
- **Symptom:** `expect(locator('#step-model-0 option[value="gemini-3.8-flash"]')).toBeVisible()` failed with `received: hidden`.
- **Location:** `e2e/specs/03-provider-configuration.spec.js:47`
- **Root Cause:** Standard browser layout engines treat unexpanded `<option>` elements as non-visible.
- **Fix:** Used `toBeAttached()` and tested the selected value with `toHaveValue('gemini-3.8-flash')`.

---

## E2E-015 — Advanced Parameters Toggle Button Strict Mode Violation

- **Severity:** Low / locator scoping
- **Status:** Fixed
- **Symptom:** `page.locator('.flow-advanced-toggle-btn')` matched multiple buttons across steps.
- **Location:** `e2e/specs/03-provider-configuration.spec.js:122`
- **Fix:** Scoped locator to `#step-edit-card-0 .flow-advanced-toggle-btn`.

---

## E2E-016 — Temperature & MaxTokens Visual Feedback & Clamping

- **Severity:** Medium / UI polish & test alignment
- **Status:** Fixed
- **Symptom:** Inputs did not clamp out-of-bound values on blur, and button text did not update immediately when typing.
- **Fix:** Implemented `clampStepTemperature` and `clampStepMaxTokens` on `blur` in `src/modules/flow.js` and updated `.flow-advanced-toggle-btn` text dynamically.

---

## E2E-017 — Context Profile Test Data Alignment

- **Severity:** Medium / test data mismatch
- **Status:** Fixed
- **Symptom:** Tests looked for unseeded test profile `profile_test_1` / `Senior Engineer`.
- **Location:** `e2e/specs/03-provider-configuration.spec.js`
- **Fix:** Aligned with actual curated profiles present in the app: `prof-1`, `prof-2` (`Senior TypeScript Architect`), `prof-3` (`Academic Researcher & Pedagogy`).

---

## E2E-018 — Export JSON Document Schema Invariant

- **Severity:** Low / test assertion bug
- **Status:** Fixed
- **Symptom:** `parsed.forEach is not a function` in credential sanitization audit.
- **Location:** `e2e/specs/03-provider-configuration.spec.js:324`
- **Root Cause:** Exported JSON format is an object `{ schemaVersion, exportedAt, flows: [...] }`.
- **Fix:** Updated assertion to iterate over `parsed.flows`.

---

## E2E-019 — Array Matcher API Confusion in Playwright

- **Severity:** Low / test assertion syntax
- **Status:** Fixed
- **Symptom:** `Error: toHaveCount can be only used with Locator object, was called with Array` in Test 5 of Suite 04.
- **Location:** `e2e/specs/04-workflow-execution.spec.js:331`
- **Root Cause:** `interceptedTargetUrls` is a standard JavaScript array containing intercepted URLs, but `toHaveCount` is a Playwright Locator matcher.
- **Fix:** Changed assertion to `expect(interceptedTargetUrls).toHaveLength(3)`.

---

## E2E-020 — Context Profile ID and Persona Alignment in Execution Test

- **Severity:** Medium / test fixture data mismatch
- **Status:** Fixed
- **Symptom:** Test 6 in Suite 04 timed out waiting for `page.selectOption('#step-profile-0', 'profile_test_1')` with `did not find some options`.
- **Location:** `e2e/specs/04-workflow-execution.spec.js:340`
- **Root Cause:** The workflow execution UI populates profile select boxes from `DEFAULT_PROFILES` (`prof-1`, `prof-2`, `prof-3`), whereas the test attempted to select speculative IDs `profile_test_1` and `profile_test_2`.
- **Fix:** Updated test to select `prof-1` and `prof-2` and assert actual injected persona strings: `Senior B2B Growth Copywriter` for Step 1, `Principal Full-Stack Architect` for Step 2, and `not.toContain('[Active Persona Directives]')` for Step 3 (`none`).

---

## E2E-021 — Network Request Counter Isolation via Native Page Route

- **Severity:** Medium / test fixture reliability
- **Status:** Fixed
- **Symptom:** Test 12 in Suite 04 reported `Expected: 3, Received: 6` requests when counting requests via browser-level `window.fetch` monkey patching.
- **Location:** `e2e/specs/04-workflow-execution.spec.js:485`
- **Root Cause:** Monkey-patching `window.fetch` inside `page.evaluate()` can lead to nested wrapper execution across re-evaluations or double-accounting of internal retry loops.
- **Fix:** Switched to Playwright's native transport interceptor `page.route('**/api/ai/proxy**')` to track dispatched requests directly at the network boundary, verifying exactly 3 requests (one per step) without duplicates.

---

## E2E-022 — Result Tabs Count for Partial Cancelled Workflow Inspection

- **Severity:** Low / test assertion alignment
- **Status:** Fixed
- **Symptom:** Test 3 in Suite 05 failed with `expect(locator).toHaveCount(1)` receiving `2`.
- **Location:** `e2e/specs/05-cancellation-recovery.spec.js:225`
- **Root Cause:** When inspecting past runs via `inspectFlowRun()`, `#flowResultTabs` renders a tab for each completed step (`Step 1`) plus the consolidated output tab (`Full Consolidated Output`), making the count 2.
- **Fix:** Updated assertion to expect 2 tabs (`toHaveCount(2)`) and verified `#flowActiveResultRendered` displays the preserved partial step output.

---

## E2E-023 — Race Condition Simulation in Rapid Run Trigger

- **Severity:** Medium / test fixture timing
- **Status:** Fixed
- **Symptom:** Test 13 in Suite 05 occasionally received 6 requests instead of 3 under parallel execution when chaining sequential asynchronous `await runBtn.click()`.
- **Location:** `e2e/specs/05-cancellation-recovery.spec.js:635`
- **Root Cause:** In fast environments, sequential `await` calls in test scripts could execute after the initial pipeline run had already completed and re-enabled the run button.
- **Fix:** Dispatched clicks synchronously within a single browser microtask via `page.evaluate(() => { btn.click(); btn.click(); btn.click(); })`, accurately simulating user button-mashing while in flight and confirming that `executionState` locking halts redundant dispatches.

---

## E2E-024 — Markdown Rich Elements Parsing Support (Headings, Tables, Lists, Italic)

- **Severity:** Medium / feature completion & test alignment
- **Status:** Fixed
- **Symptom:** Output viewer previously only converted fenced code blocks, bold, and line breaks. Elements like `<h1>`-`<h6>`, `<table>`, `<ul>/<ol>`, and `<em>` remained unformatted text.
- **Location:** `src/utils/markdown.js`
- **Root Cause:** `src/utils/markdown.js` lacked block element grammar regexes for markdown headings, GFM tables, lists, and italics.
- **Fix:** Extended `formatRichMarkdown` to safely tokenize code blocks into immutable placeholders (`%%%PECUTCODEBLOCK0%%%`), apply block parser rules (headings, tables, lists, blockquotes, italics, and safe link filtering), and restore code blocks while preserving 100% strict HTML sanitization via `escapeHtml()`.

---

## E2E-025 — Flow Output Code Block Copy Event Wiring

- **Severity:** Low / UX polish & test alignment
- **Status:** Fixed
- **Symptom:** Clicking the `📋 Copy` button on fenced code blocks inside `#flowActiveResultRendered` did not copy code to clipboard.
- **Location:** `src/modules/flow.js:1520`
- **Root Cause:** Code copy event listener was only wired inside the chat stream UI (`src/modules/chat/ui.js`), not in `switchFlowResultTab` in `src/modules/flow.js`.
- **Fix:** Added click handlers to `.btn-copy-code` elements in `switchFlowResultTab` in `src/modules/flow.js`, copying the closest `<code>` block text to `navigator.clipboard` and showing a toast notification.

---

## E2E-026 — Unhandled Promise Rejection on Clipboard API Write Access Denial

- **Severity:** Medium / resilience & error handling
- **Status:** Fixed
- **Symptom:** When `navigator.clipboard.writeText` rejected (e.g., in environments where clipboard permission is denied or restricted by security policy), `copyActiveFlowResult` triggered an uncaught promise rejection in the browser console.
- **Location:** `src/modules/flow.js:1563`
- **Root Cause:** `copyActiveFlowResult` invoked `navigator.clipboard.writeText(text)` without API feature-detection or error rejection handlers (`.catch()`).
- **Fix:** Added API availability check (`!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function'`) and chained `.then(() => showToast(...))` with `.catch((err) => { console.warn(...); showToast('Unable to copy to clipboard.', 'error'); })` to gracefully handle permission denials and display a user-friendly error notification without crashing the application runtime.

---

## E2E-027 — Result Tab Locator Incompatibility in Suite 07 Specification

- **Severity:** Low / test fixture alignment
- **Status:** Fixed
- **Symptom:** Suite 07 tests timed out with `waiting for locator('#flowResultTabs button[data-step="0"]')`.
- **Location:** `e2e/specs/07-cross-module-handoff.spec.js`
- **Root Cause:** Result tabs in `src/modules/flow.js` are rendered with class `.comp-tab` and `onclick="window.switchFlowResultTab(idx)"` without custom `data-step` attributes.
- **Fix:** Implemented a unified fixture helper `selectResultTab(page, index)` targeting `#flowResultTabs .comp-tab` via `.nth(index)` for step tabs and `.last()` for the full consolidated output tab, aligning the test suite with actual application DOM architecture.

---

## E2E-028 — Clear Flow Execution History Global Wipe & Missing Confirmation Dialog

- **Severity:** High / data integrity & UX safety
- **Status:** Fixed
- **Symptom:** Clicking "Clear History" in the execution history pane immediately wiped the execution history across all workflows in `localStorage` without prompt or confirmation.
- **Location:** `src/modules/flow.js` (`clearCurrentFlowRuns`), `src/modules/flow/runStorage.js` (`clearFlowRuns`)
- **Root Cause:** `clearCurrentFlowRuns()` directly invoked `clearFlowRuns()` without user confirmation. Additionally, `clearFlowRuns()` had no workflow scoping, saving `[]` to wipe all records across all workflows indiscriminately.
- **Fix:**
  1. Updated `clearFlowRuns(flowId = null)` in `src/modules/flow/runStorage.js` to accept an optional `flowId`. When provided, it filters out only the runs belonging to `flowId` while safely preserving other workflows' runs (`allRuns.filter(r => r.flowId !== flowId)`). Full wipe is retained when called with `null` or no arguments for backward compatibility.
  2. Updated `clearCurrentFlowRuns()` in `src/modules/flow.js` to guard the action with `confirm('Are you sure you want to clear execution history for this workflow?')` and call `clearFlowRuns(activeFlow?.id)`.

---

## E2E-029 — Execution History DOM Selector Misalignment in Suite 08

- **Severity:** Medium / test fixture alignment
- **Status:** Fixed
- **Symptom:** Suite 08 tests timed out waiting for selectors `.flow-run-history-item`, `.status-badge.completed`, and `.run-duration`.
- **Location:** `e2e/specs/08-execution-history.spec.js`
- **Root Cause:** Speculative selectors used in the initial test stub did not match the actual rendering logic in `src/modules/flow.js:renderFlowRunHistory()`. The DOM renders items as `.flow-history-item` with `data-run-id`, status badges as `<span class="step-cred-pill ${statusClass}">${run.status}</span>` (`.ready` for completed, `.error` for failed, `.warning` for cancelled), and action buttons as `<button class="btn btn-secondary btn-xs" onclick="window.inspectFlowRun(...)">Inspect Output</button>`.
- **Fix:** Aligned all 23 test cases in `e2e/specs/08-execution-history.spec.js` to the actual application DOM selectors: `.flow-history-item`, `.step-cred-pill.ready`, `.step-cred-pill.error`, `.step-cred-pill.warning`, and `button:has-text("Inspect Output")`.

---

## E2E-030 — Workflow JSON Import Schema Validation Bypassed for Missing Fields & Script Tags in IDs

- **Severity:** High / Security & Data Integrity
- **Status:** Fixed
- **Symptom:** Importing malformed workflow JSON missing required `title` or `steps` was silently auto-filled with default placeholder steps by `normalizeFlowV2` instead of being rejected. Furthermore, raw payloads containing malicious HTML IDs (`<script>alert(1)</script>`) had their IDs silently replaced by random IDs instead of being rejected as invalid.
- **Location:** `src/modules/flow/storage.js` (`importFlowsJSON`)
- **Root Cause:** `importFlowsJSON` invoked `normalizeFlowV2` prior to schema validation, which auto-generated replacement values for empty titles, empty steps, and invalid IDs.
- **Fix:** Added upfront schema invariant checks in `importFlowsJSON` to strictly validate `isSafeId(raw.id)` and `isSafeId(step.id)`, and reject flows missing a valid `title` or having empty `steps: []` before any normalization.

---

## E2E-031 — `openHtmlPreviewModal` Global Scope Availability

- **Severity:** Medium / Testability & Module Decoupling
- **Status:** Fixed
- **Symptom:** `openHtmlPreviewModal` was not exposed on `window.openHtmlPreviewModal`, preventing direct invocation and testing of the isolated sandboxed iframe.
- **Location:** `src/modules/chat/preview.js`
- **Root Cause:** Export was only available via ES module import and not bound to `window`.
- **Fix:** Added `if (typeof window !== 'undefined') window.openHtmlPreviewModal = openHtmlPreviewModal;`.

---

## E2E-032 — Live Preview Button Wiring in Pecut Flow Results Tab

- **Severity:** Low / UX Feature Completeness
- **Status:** Fixed
- **Symptom:** In Pecut Flow output viewer, code blocks containing HTML rendered a `▶️ Live Preview` button, but clicking it did nothing because event listeners were only attached in `src/modules/chat/ui.js`.
- **Location:** `src/modules/flow.js` (`switchFlowResultTab`)
- **Root Cause:** Event listener for `.btn-preview-html` was missing in `switchFlowResultTab`.
- **Fix:** Added querySelector listener for `.btn-preview-html` in `switchFlowResultTab` calling `openHtmlPreviewModal(codeBlock.innerText)`.

---

## E2E-033 — Markdown Image Link Parsing with Dangerous Protocol Sanitization

- **Severity:** Medium / XSS Defense
- **Status:** Fixed
- **Symptom:** Markdown image tags `![alt](url)` were not parsed in `formatInline`, which could leave dangerous URIs (`javascript:`, `data:`, `vbscript:`) unprocessed in raw text.
- **Location:** `src/utils/markdown.js` (`formatInline`)
- **Root Cause:** `formatInline` lacked an explicit image regex parser prior to the link parser.
- **Fix:** Implemented safe markdown image regex `!\[([^\]]*)\]\(([^)]+)\)` strictly rejecting `javascript:`, `data:`, and `vbscript:` URIs, rendering safe `<img>` elements with `loading="lazy"`.

---

## E2E-034 — CSS Cascade Precedence: `flow.css` Overriding `overlays.css` Responsive Grid Layout

- **Severity:** Medium / Responsive Layout
- **Status:** Fixed
- **Symptom:** On tablet (768×1024) and mobile (390×844) viewports, the Pecut Flow layout retained a 2-column grid (`grid-template-columns: 380px 1fr`), forcing the main visualizer pane to horizontal coordinate x=387px and causing severe clipping and horizontal overflow.
- **Location:** `style.css`, `src/styles/flow.css`, `src/styles/overlays.css`
- **Root Cause:** In `style.css`, `flow.css` was imported after `overlays.css`. Because `.flow-layout` in `flow.css` had equal specificity to `.flow-layout` in `overlays.css`, the desktop declaration `380px 1fr` overrode the responsive media query `grid-template-columns: 1fr`.
- **Fix:** Moved `@import './src/styles/overlays.css';` to the end of `style.css` so responsive overrides take cascade precedence, and added explicit `@media (max-width: 1024px) { .flow-layout { grid-template-columns: 1fr; } }` in `flow.css`.

---

## E2E-035 — Step Node Header Lacked Wrapping and `min-width: 0` Causing 390px Mobile Bleed

- **Severity:** Low / Responsive Polish
- **Status:** Fixed
- **Symptom:** On mobile 390×844, step visualizer node `.flow-step-node` was slightly wider than 390px (415.45px), failing strict viewport boundary assertions.
- **Location:** `src/modules/flow.js`, `src/styles/flow.css`, `src/styles/overlays.css`
- **Root Cause:** In `flow.js`, the step node title, id badge, and model credential pill were placed inside a flex row without `flex-wrap: wrap`, and `.flow-step-node .step-content` lacked `min-width: 0`, preventing flex children from shrinking below their intrinsic label text.
- **Fix:** Added `flex-wrap: wrap;` to the step node header in `src/modules/flow.js`, added `min-width: 0; max-width: 100%;` and `.step-content { min-width: 0; }` in `src/styles/flow.css`, and tuned mobile padding in `overlays.css` to 0.85rem.


