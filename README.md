# Pecut AI

**Think Better. Work Smarter. Move Faster.**

Pecut AI is an open-source AI productivity workspace designed to "pecut" (whip/discipline) AI into producing structured, high-quality, and chained outputs. Organize reusable context, build rock-solid prompts, and chain multi-step workflows in one unified, privacy-first environment.

---

## 🌟 Highlights

- **Multi-Provider BYOK (Bring Your Own Key):** Connect OpenRouter (free & multi-model), Google Gemini, Groq Cloud, OpenAI, or local Ollama instances directly in your browser.
- **Zero-Cost Vercel Deployment:** Deploy to Vercel in 1-click. Free static hosting + lightweight serverless proxy to eliminate browser CORS.
- **100% Local Privacy:** API keys, context profiles, and custom templates are stored on your device (`localStorage`). Zero secrets are saved on server disks or external databases.
- **Sequential Prompt Chaining (Pecut Flow):** Run structured multi-step pipelines (Content Creation, Spec-to-Code, Deep Concept Mastery) with real-time AI execution.
- **Context Profiles:** Save brand rules, developer guidelines, or technical personas and inject them into any prompt with 1 click.

---

## 🛠️ Feature Inventory

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Multi-Provider BYOK** | :white_check_mark: Active | OpenRouter (Free tier models), Gemini, Groq, OpenAI & Ollama/Local |
| **Universal Vercel Proxy** | :white_check_mark: Active | `/api/ai/proxy` with domain allowlist (Anti-SSRF) to eliminate CORS |
| **Pecut Flow (Chaining Engine)** | :white_check_mark: Active | Multi-step sequential prompt chaining pipeline with real AI execution |
| **Context Profiles** | :white_check_mark: Active | Reusable brand identities, personas, and 1-click builder injection |
| **Structured Prompt Builder** | :white_check_mark: Active | Role, Objective, Context, Instructions, Constraints, Token estimation |
| **Dual-Mode Prompt Optimizer** | :white_check_mark: Active | Real AI enhancement via BYOK + offline deterministic structural fallback |
| **Prompt Library** | :white_check_mark: Active | Full local CRUD, favorites, search, category filter, JSON backup/restore |
| **22 Curated Templates** | :white_check_mark: Active | Programming, Business, Writing, Education, Marketing, Research |
| **Execution History** | :white_check_mark: Active | Activity log with 1-click restore to builder |
| **Settings & Theming** | :white_check_mark: Active | Dark / Light theme tokens, high-contrast focus rings, reduced-motion |
| **Command Palette** | :white_check_mark: Active | Keyboard shortcuts (`Ctrl+K`, `Ctrl+Enter`, `Ctrl+S`, `Escape`) |

---

## 🚀 Deployment & Quick Start

### 1. Deploy to Vercel (1-Click, 100% Free)
1. Fork or clone this repository to your GitHub account: `https://github.com/AQYV999/pecut-ai`.
2. Go to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Select your `pecut-ai` repository. Vercel automatically detects the Vite framework and `vercel.json`.
4. Click **Deploy**. Within 60 seconds, your site is live!
5. Open your live URL, click the **AI Status Badge** in the topbar, enter your OpenRouter, Gemini, or Groq API key, and start creating.

### 2. Local Development
```bash
git clone https://github.com/AQYV999/pecut-ai.git
cd pecut-ai
npm install
npm run dev      # Starts Vite dev server on http://localhost:5173
```

### 3. Self-Hosted Server
```bash
# Optional: Set server-level GEMINI_API_KEY in .env
cp .env.example .env

npm run build    # Compiles production assets into dist/
npm start        # Launches zero-dependency server on http://localhost:3000
```

### 4. Run Test Suite
```bash
npm test         # Runs 27 automated unit tests across all layers
```

---

## 🏗️ Architecture

```
pecut-ai/
├── api/
│   └── ai/
│       └── proxy.js            # Universal Serverless AI Proxy (Anti-SSRF & CORS)
├── src/
│   ├── main.js                 # Central application bootstrapping
│   ├── data/
│   │   ├── models.js           # AI provider presets & default free models
│   │   ├── flows.js            # Pecut Flow multi-step pipelines
│   │   ├── profiles.js         # Curated Context Profiles
│   │   └── templates.js        # 22 curated professional prompt templates
│   ├── modules/
│   │   ├── aiModal.js          # AI connection & BYOK settings controller
│   │   ├── builder.js          # Prompt Builder form & live preview
│   │   ├── optimizer.js        # Prompt structural analysis & enhancement
│   │   ├── flow.js             # Pecut Flow sequential execution engine
│   │   ├── profiles.js         # Context Profiles manager
│   │   ├── library.js          # Library CRUD, search, filter, JSON export/import
│   │   ├── templates.js        # Template catalog & modal preview
│   │   ├── history.js          # Execution history logger & restore
│   │   ├── storage.js          # Local state persistence & theme manager
│   │   ├── navigation.js       # View routing & mobile sidebar navigation
│   │   ├── settings.js         # User preferences & workspace reset
│   │   └── commandPalette.js   # Keyboard shortcuts & quick search
│   ├── services/
│   │   └── ai/
│   │       ├── client.js       # Unified Client AI service (3-tier cascade)
│   │       └── index.js        # Service entry point & backward compatibility
│   └── utils/
│       └── helpers.js          # XSS escaping & toast notifications
├── server/
│   ├── index.js                # Self-hosted Node.js HTTP server (zero deps)
│   └── providers/
│       └── gemini.js           # Server-side Gemini adapter
├── tests/
│   ├── aiClient.test.js        # Client cascade & local origin tests
│   ├── proxy.test.js           # SSRF protection & proxy routing tests
│   ├── byokStorage.test.js     # BYOK configuration persistence tests
│   ├── templates.test.js       # Template schema tests
│   ├── optimizer.test.js       # Structural analyzer tests
│   ├── profiles.test.js        # Context profiles tests
│   ├── flow.test.js            # Workflow pipeline integrity tests
│   ├── storage.test.js         # Security & state persistence tests
│   ├── server.test.js          # Backend endpoint tests
│   └── helpers.test.js         # Sanitization tests
├── vercel.json                 # Vercel deployment configuration
├── index.html                  # Semantic dashboard markup
├── style.css                   # Design tokens, themes & layout styles
└── LICENSE                     # Apache License 2.0
```

---

## 🔒 Security & Privacy (BYOK)
- **Zero Token Leakage:** API keys are never submitted to, logged by, or stored in any backend database.
- **Client-Side Persistence:** Keys reside exclusively in your browser's private `localStorage`.
- **Domain Allowlist:** The serverless proxy enforces strict domain filtering (`openrouter.ai`, `generativelanguage.googleapis.com`, `api.groq.com`, `api.openai.com`) to prevent open proxy exploitation.
- **Localhost Passthrough:** Connections to local model servers (`localhost:11434` for Ollama) are made directly by your browser, bypassing the cloud proxy entirely.

---

## 📄 License
Licensed under the [Apache License, Version 2.0](LICENSE).
Documentation licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
