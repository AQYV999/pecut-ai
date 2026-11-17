# Design Document: Multi-Provider BYOK & Vercel Universal Deployment

- **Date:** 2026-11-17
- **Project:** Pecut AI (`pecut-ai`)
- **Status:** Approved Draft (Builder Reviewed)

---

## 1. Intent & The "Why"
Pecut AI was created as an open-source AI productivity workspace designed to "pecut" (whip/discipline) AI into producing structured, high-quality, and chained outputs through tools like Prompt Builder, Context Profiles, Dual-Mode Optimizer, and Pecut Flow.

The project currently runs locally using environment variables. To make Pecut AI a publicly accessible web application on Vercel that anyone can use without incurring server or API token costs for the creator, Pecut AI needs a **Bring Your Own Key (BYOK) Multi-Provider Architecture**.

Users visiting the hosted Vercel site can input their own API key (e.g., from OpenRouter, Google Gemini, Groq, or OpenAI) directly in the UI. The web application will use their personal quota without storing keys on any central database.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **Multi-Provider UI:** A sleek, user-friendly settings modal in the UI where users can choose an AI provider (OpenRouter, Google Gemini, Groq, OpenAI, or Custom OpenAI-compatible URL), enter their API Key, and pick or type a Model ID.
2. **Universal Vercel Proxy (`api/ai/proxy.js`):** A lightweight Vercel serverless function that forwards client requests to the chosen AI provider with the user's headers (`Authorization: Bearer <key>`). This resolves all browser CORS issues cleanly.
3. **Zero-Knowledge Privacy:** API keys are saved strictly in the user's browser `localStorage` on their own device (`pecut_byok_config`). The Vercel proxy merely streams/relays requests in-flight and stores zero secrets, logs, or credentials.
4. **Unified Client AI Service:** Refactor frontend AI calls into `src/services/ai/client.js` using the standard OpenAI-compatible chat completion payload format across all providers.
5. **Local & Cloud Parity:** The local dev server (`server/index.js` or Vite proxy) and production Vercel deployment both support `/api/ai/proxy` seamlessly.
6. **Deployable to Vercel in 1-Click:** Add `vercel.json` configuration so pushing to GitHub automatically builds and deploys the Vite app + serverless API route on Vercel's free tier.

### Non-Goals
1. **No Firebase or Central Database:** User profiles, templates, history, and API keys reside locally in the user's browser. No user authentication, logins, or cloud database setup at this stage.
2. **No Central API Key Pool / Billing:** The hosted platform does not provide a paid backend or shared token pool. It is purely BYOK.
3. **No Heavy Frontend Framework:** Maintain the lightweight, fast Vanilla JS ES Modules + Vite architecture.

### Anti-Goals
1. Never hardcode API keys or secrets in repository code or client builds.
2. Never store client API keys on server disk or persistent cloud databases.
3. Never break offline/demo functionality: if a user does not have an API key, the deterministic local mock/analyzer must continue to work seamlessly.

---

## 3. Constraints
- **Stack:** Vite, Vanilla JavaScript ES Modules, Native Node.js (for serverless proxy and local server), CSS variables.
- **Hosting:** Vercel Free Tier (Serverless Functions + Static Assets).
- **CORS & Network:** Public cloud providers route through `/api/ai/proxy` to eliminate browser CORS errors.
- **Backwards Compatibility:** Existing prompt templates, library CRUD, context profiles, and flows must continue working with zero regression.

---

## 4. Approaches Considered

### Approach 1: Pure Client-Side Direct Fetch (Jamstack)
- *Description:* Browser directly calls AI provider endpoints via `fetch()`.
- *Why Rejected:* OpenAI, Anthropic, and many enterprise endpoints reject direct browser origins due to CORS policies.

### Approach 2: Universal Vercel Forwarder (`api/ai/proxy.js`) — [SELECTED]
- *Description:* A tiny zero-dependency serverless route on Vercel acts as an HTTP relay. The browser sends the request to `/api/ai/proxy` with headers containing the target endpoint and API key.
- *Why Chosen:*
  - Completely eliminates CORS limitations for all providers.
  - Zero storage on Vercel: 100% ephemeral in-flight relay.
  - Free and instant to deploy on Vercel.
  - Supports OpenRouter (access to 100+ models including free tier models like Llama 3, DeepSeek, Mistral), Groq (ultra-fast inference), Gemini, and OpenAI.

---

## 5. Architectural & Technical Specifications (Resolved Post-Review)

### 5.1 Provider Presets & Uniform OpenAI Format
All supported providers leverage standard OpenAI chat completion schemas (`/v1/chat/completions`), eliminating payload translation overhead:
1. **OpenRouter (Default / Recommended):**
   - Base URL: `https://openrouter.ai/api/v1`
   - Default Models: `meta-llama/llama-3.3-70b-instruct:free`, `google/gemini-2.0-flash-exp:free`, `mistralai/mistral-small-24b-instruct-2501:free`
2. **Google Gemini (OpenAI Endpoint):**
   - Base URL: `https://generativelanguage.googleapis.com/v1beta/openai`
   - Default Model: `gemini-1.5-flash`
3. **Groq:**
   - Base URL: `https://api.groq.com/openai/v1`
   - Default Model: `llama-3.3-70b-versatile`
4. **OpenAI:**
   - Base URL: `https://api.openai.com/v1`
   - Default Model: `gpt-4o-mini`
5. **Custom / Local (Ollama, LMStudio, vLLM):**
   - Configurable Base URL & Model ID.

### 5.2 SSRF Protection & Dual-Path Network Dispatching
- **Proxy Security (`api/ai/proxy.js`):** Enforces a domain allowlist:
  - `openrouter.ai`
  - `generativelanguage.googleapis.com`
  - `api.groq.com`
  - `api.openai.com`
  Requests with unknown target hostnames outside the allowlist are rejected with HTTP 403 to prevent open proxy / SSRF abuse.
- **Local Network Presets:** For local custom URLs (`localhost`, `127.0.0.1`), `src/services/ai/client.js` executes direct browser `fetch()` calls rather than routing through Vercel cloud serverless (which cannot reach local client hardware).

### 5.3 Universal Proxy Specifications (`api/ai/proxy.js`)
- Accepts `POST` requests.
- Headers read:
  - `x-target-url`: Full URL to destination completion endpoint (must match domain allowlist).
  - `Authorization`: Bearer token (API key).
- Body: Standard JSON `{ model, messages, temperature, max_tokens }`.
- Request forward timeout: 12 seconds (safely under Vercel Free Tier 15s limit).
- Returns the provider's completion response JSON directly.

### 5.4 Multi-Tiered Resolution Cascade
`src/services/ai/client.js` executes in cascade order:
1. **Tier 1 (Client BYOK):** If the user has saved an API key in `localStorage` (`pecut_byok_config`), use it via `/api/ai/proxy`.
2. **Tier 2 (Server .env Fallback):** If no client key is set, and running against a self-hosted Node server that has `GEMINI_API_KEY`, use server endpoints (`/api/ai/optimize`, `/api/ai/flow/step`).
3. **Tier 3 (Deterministic Mock):** If no keys exist anywhere, fall back cleanly to local structural optimization and mock flow generation.

### 5.5 Connection Test & Verification
- Connection testing issues a minimal 1-token request (`messages: [{ role: 'user', content: 'hi' }], max_tokens: 1`) to verify key authentication and model availability without wasting user quota.

### 5.6 UI Integration
- Topbar indicator shows active provider & model (e.g. `[OpenRouter: llama-3.3-70b]` or `[BYOK Config]`).
- Settings modal provides:
  - Provider selector dropdown with provider logos/badges.
  - API Key input field with secure masked view and show/hide toggle.
  - Model selection with quick-pick badges (including FREE tier badges) and custom manual input.
  - "Test Connection" button with live status badge (green ping / red error).
  - "Save to Browser" button and "Clear Key" button.

---

## 6. What's Left to the Builder
- Detailed CSS styling matching existing dark/light theme variables in `style.css`.
- Exact test assertions in `tests/proxy.test.js` and `tests/aiClient.test.js`.
- Adding `api/ai/proxy.js` for Vercel Serverless Function and `vercel.json` deployment rules.
