# Design Document: Multi-Provider BYOK & Vercel Universal Deployment

- **Date:** 2026-11-17
- **Project:** Pecut AI (`pecut-ai`)
- **Status:** Proposed (Brainstorming Milestone)

---

## 1. Intent & The "Why"
Pecut AI was created as an open-source AI productivity workspace designed to "pecut" (whip/discipline) AI into producing structured, high-quality, and chained outputs through tools like Prompt Builder, Context Profiles, Dual-Mode Optimizer, and Pecut Flow.

The project currently runs locally using environment variables. To make Pecut AI a publicly accessible web application on Vercel that anyone can use without incurring server or API token costs for the creator, Pecut AI needs a **Bring Your Own Key (BYOK) Multi-Provider Architecture**.

Users visiting the hosted Vercel site can input their own API key (e.g., from OpenRouter, Google Gemini, Groq, or OpenAI) directly in the UI. The web application will use their personal quota without storing keys on any central database.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **Multi-Provider UI:** A sleek, user-friendly settings modal in the UI where users can choose an AI provider (OpenRouter, Google Gemini, Groq, OpenAI, or Custom OpenAI-compatible URL), enter their API Key, and pick or type a Model ID.
2. **Universal Vercel Proxy (`/api/ai/proxy`):** A lightweight Vercel serverless function (in `api/ai/proxy.js`) that forwards client requests to the chosen AI provider with the user's headers (`Authorization: Bearer <key>` or `x-goog-api-key`). This resolves all browser CORS issues cleanly.
3. **Zero-Knowledge Privacy:** API keys are saved strictly in the user's browser `localStorage` on their own device. The Vercel proxy merely streams/relays requests in-flight and stores zero secrets, logs, or credentials.
4. **Unified Client AI Service:** Refactor frontend AI calls in `src/services/ai/` into a single unified client (`aiClient.js`) that standardizes request and response formats for Optimizer, Flow, and future features.
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
- **CORS & Network:** All external API requests from the browser route through the lightweight proxy to prevent CORS blocking from strict providers.
- **Backwards Compatibility:** Existing prompt templates, library CRUD, context profiles, and flows must continue working with zero regression.

---

## 4. Approaches Considered

### Approach 1: Pure Client-Side Direct Fetch (Jamstack)
- *Description:* Browser directly calls AI provider endpoints via `fetch()`.
- *Why Rejected:* While Google Gemini and OpenRouter support browser CORS, OpenAI, Anthropic, and many custom enterprise endpoints block direct browser origins with CORS errors. This would limit provider compatibility and confuse users when certain models fail.

### Approach 2: Universal Vercel Forwarder (`api/ai/proxy.js`) — [SELECTED]
- *Description:* A tiny zero-dependency serverless route on Vercel acts as an HTTP relay. The browser sends the request to `/api/ai/proxy` with headers containing the target endpoint and API key. The serverless function executes the fetch and returns the response.
- *Why Chosen:*
  - Completely eliminates CORS limitations for all providers.
  - Zero storage on Vercel: 100% ephemeral in-flight relay.
  - Free and instant to deploy on Vercel.
  - Supports OpenRouter (access to 100+ models including free tier models like Llama 3, DeepSeek, Mistral), Groq (ultra-fast inference), Gemini, and OpenAI.

---

## 5. Technical Architecture & Implementation Plan

### 5.1 Provider Presets & Configuration
Default presets offered in the UI:
1. **OpenRouter (Default / Recommended):**
   - Base URL: `https://openrouter.ai/api/v1`
   - Default Models: `meta-llama/llama-3.3-70b-instruct:free`, `google/gemini-2.0-flash-exp:free`, `mistralai/mistral-small-24b-instruct-2501:free`
2. **Google Gemini:**
   - Base URL: `https://generativelanguage.googleapis.com/v1beta`
   - Default Model: `gemini-1.5-flash`
3. **Groq:**
   - Base URL: `https://api.groq.com/openai/v1`
   - Default Model: `llama-3.3-70b-versatile`
4. **OpenAI:**
   - Base URL: `https://api.openai.com/v1`
   - Default Model: `gpt-4o-mini`
5. **Custom / Local (Ollama, vLLM, LMStudio):**
   - Configurable Base URL & Model ID.

### 5.2 Serverless Forwarder (`api/ai/proxy.js`)
- Accepts `POST` requests.
- Headers read:
  - `x-target-url`: Full URL to the destination completion endpoint.
  - `x-api-key`: User's API key.
  - `x-provider`: Provider identifier (e.g. `openrouter`, `gemini`, `openai`, `groq`).
- Body: Standard OpenAI-compatible chat payload `{ model, messages, temperature, max_tokens }` (translated for Gemini if necessary).
- Returns the provider's completion response directly to client.

### 5.3 Client AI Service (`src/services/ai/client.js`)
- Reads active provider, key, and model from `storage.js`.
- Dispatches requests to `/api/ai/proxy`.
- Provides high-level methods:
  - `completeChat({ messages, systemPrompt, temperature })`
  - `optimizePrompt(rawPrompt, mode)`
  - `executeFlowStep(flowId, stepIndex, input, previousOutputs)`
  - `checkStatus()`
- If no key is configured, cleanly falls back to deterministic local mock without throwing uncaught exceptions.

### 5.4 UI Changes
- Topbar indicator updated: Displays active provider name (e.g. `[OpenRouter: llama-3.3-70b]`, `[Gemini]`, or `[Demo Mode]`).
- Clicking the indicator or settings button opens the **AI Connection Modal**.
- Fields:
  - Provider Dropdown (OpenRouter, Gemini, Groq, OpenAI, Custom).
  - API Key Input (masked password input with show/hide toggle).
  - Model Selection (quick-select popular models + free models badge, or manual text input).
  - Test Connection button with visual status response.
  - Clear / Remove Key button.

---

## 6. What's Left to the Builder
- Detailed CSS styling conforming to existing dark/light theme variables in `style.css`.
- Exact test assertions in `tests/proxy.test.js` and `tests/aiClient.test.js`.
- `vercel.json` deployment headers and route configuration.
