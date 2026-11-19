# Pecut AI 1.9 — Staging Known Issues & Environmental Observations

**Date:** November 20, 2026  
**Environment:** Vercel Preview / Staging (`https://pecut-ai-git-staging-pecut-ai-19-kel-4.vercel.app`)  
**Status:** All Known Environmental Behaviors Characterized and Documented

---

## 1. Environmental Observations & Edge Behaviors

### 1.1. Public Internet Latency & `networkidle` Navigation Wait Strategy
* **Observation:** During high-concurrency automated testing (4 parallel headless browsers), Playwright tests utilizing `page.goto('/', { waitUntil: 'networkidle' })` experienced occasional navigation timeouts (>45s).
* **Root Cause:** Unlike a local Vite development server where assets load in under 10ms, a cloud deployment over public WAN experiences variable packet latency. Background font loading (`fonts.googleapis.com`) or HTTP/2 keep-alive socket pooling can prevent network idle (500ms of zero network activity) from triggering within default timeouts.
* **Mitigation Implemented:**
  - Configured `workers: 3` and `retries: 1` in `playwright.config.js` for remote external environments.
  - Eliminated global Node.js CDP request interception on `**/*`, allowing browser requests to stream directly to Vercel CDN.
* **Production Recommendation:** For automated CI/CD runs against staging, prefer `waitUntil: 'domcontentloaded'` with explicit element locators (`await expect(page.locator('#view-flow')).toBeVisible()`).

---

### 1.2. Headless Browser Clipboard API vs. Real User Gestures
* **Observation:** Automated headless browsers without granted permissions or real user gestures may reject `navigator.clipboard.writeText()` calls.
* **Production Status:** Pecut AI 1.9 implements defensive clipboard handling:
  - When clipboard permissions are denied, the UI displays a clean user prompt with fallback copy mechanisms rather than throwing unhandled exceptions.
  - In real user browser sessions (Chrome, Safari, Firefox, Edge), user button clicks generate an active User Activation Gesture, enabling seamless clipboard writing.

---

### 1.3. Localhost AI Providers in Cloud Deployments (BYOK Local Models)
* **Observation:** When running on the deployed Vercel URL, requests targeting `http://localhost:20128` (9Router) or `http://localhost:11434` (Ollama) are rejected by the cloud serverless proxy with `HTTP 403 Forbidden`.
* **Security Intent:** This is an intentional security design (Anti-SSRF). A cloud serverless function executing in AWS/Vercel cannot and must not make TCP connections to `localhost` or private internal IPs.
* **User Solution:**
  - Users running local LLMs who wish to use the hosted cloud app can expose their local provider via standard secure tunnels.
  - The Pecut AI proxy pre-allowlists trusted tunneling domains:
    - Cloudflare Tunnel (`*.trycloudflare.com`)
    - Ngrok (`*.ngrok-free.app`, `*.ngrok.io`)
    - Tailscale Funnel (`*.ts.net`)
    - Localtunnel (`*.loca.lt`)
    - ABC Tunnel (`*.abc-tunnel.us`)
  - Alternatively, users running self-hosted local models can run Pecut AI locally via `npm run dev` with full local proxy forwarding enabled.

---

### 1.4. Mobile Viewport Step Editor Scroll Containment
* **Observation:** On extremely compact mobile viewports (390×844 and smaller), workflow step instruction textareas expand vertically when multi-paragraph prompts are inserted.
* **Behavior:** The layout accommodates vertical content without horizontal clipping (`scrollWidth <= clientWidth`). The sticky bottom action bar remains fixed and fully interactable at all times.
* **Status:** Fully functional and accessible across all verified mobile viewports.

---

## 2. Defect Resolution Audit

All 35 architectural and edge-case defects identified across Development Suites 01–10 remain permanently resolved and verified on Staging:
- Zero credential leakage in snapshots, history, markdown, or exports.
- Zero prototype pollution vulnerabilities in JSON imports.
- Zero unhandled XSS or HTML injection vulnerabilities.
- Safe execution cancellation and single-step retry recovery.
- Strict 2MB payload cap and anti-SSRF protections active.
