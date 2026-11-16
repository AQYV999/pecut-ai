# Pecut AI

**Think Better. Work Smarter. Move Faster.**

Pecut AI is an open-source AI productivity workspace designed to help individuals and teams structure better prompts, organize reusable context, and manage their AI-powered work in one unified environment.

---

## 🌟 Overview

Rather than scattering prompts and instructions across countless chat windows, Pecut AI provides a dedicated workspace to build, optimize, manage, and reuse structured AI workflows.

### Core Philosophy: Open-Core & Community First
- **Pecut AI Community Edition (Public):** Free, self-hostable, and open-source under the Apache-2.0 license. Works with your own AI provider keys (BYOK).
- **Pecut AI Cloud (Hosted):** Managed cloud service with cross-device sync, managed AI credits, and team collaboration.

---

## 🛠️ Feature Inventory (v0.1.0 — Stage 1)

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Overview Dashboard** | :white_check_mark: Active | Live metrics, quick navigation, and recent activity feed |
| **Structured Prompt Builder** | :white_check_mark: Active | Role, Objective, Context, Instructions, Constraints, Live Preview, Token estimation |
| **Deterministic Prompt Optimizer** | :white_check_mark: Active (Local) | Structural rule-based analysis (honest reporting, no fake scores; real AI integration in Stage 2) |
| **Prompt Library** | :white_check_mark: Active | Full local CRUD, favorites, duplicate, search, category filter, JSON import/export |
| **22 Curated Templates** | :white_check_mark: Active | Programming, Business, Writing, Education, Marketing, Research, Creative, Productivity |
| **Execution History** | :white_check_mark: Active | Activity log with 1-click restore to builder |
| **Settings & Theming** | :white_check_mark: Active | Dark / Light theme tokens, high-contrast focus rings, reduced-motion support |
| **Command Palette** | :white_check_mark: Active | Keyboard shortcuts (`Ctrl+K`, `Ctrl+Enter`, `Ctrl+S`, `Escape`) |
| **Pecut Flow (Workflow Chaining)** | :white_check_mark: Active | Multi-step sequential prompt chaining pipeline (Content, Code & Study flows) |
| **Context Profiles** | :white_check_mark: Active | Reusable brand identity, technical personas, and 1-click builder injection |
| **Real AI Integration (BYOK)** | :white_check_mark: Active | Google Gemini (`gemini-1.5-flash`) via lightweight zero-dependency server |

---

## 🚀 Quick Start (Local & Self-Hosted)

### Prerequisites
- Node.js 18+ (tested on Node.js v20+)
- npm or pnpm

### 1. Development Mode (Frontend + Proxy)
```bash
npm install
npm run dev      # Starts Vite on http://localhost:5173
```

### 2. Self-Hosted Server (Full Stack with Gemini BYOK)
```bash
# Configure your Gemini API key:
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

npm run build    # Compiles production assets into dist/
npm start        # Launches zero-dependency server on http://localhost:3000
```

### 3. Run Test Suite
```bash
npm test         # Runs Node native test suite (11 unit tests)
```

---

## 🏗️ Architecture

Pecut AI uses a lightweight, modular vanilla JavaScript architecture orchestrated by Vite:

```
pecut-ai/
├── src/
│   ├── main.js                 # Central application entry point
│   ├── data/
│   │   └── templates.js        # 22 curated professional prompt templates
│   ├── modules/
│   │   ├── builder.js          # Prompt Builder form & live preview
│   │   ├── optimizer.js        # Prompt structural analysis & enhancement
│   │   ├── library.js          # Library CRUD, search, filter, JSON export/import
│   │   ├── templates.js        # Template catalog & modal preview
│   │   ├── history.js          # Execution history logger & restore
│   │   ├── storage.js          # Local state persistence & theme manager
│   │   ├── navigation.js       # View routing & mobile sidebar navigation
│   │   ├── settings.js         # User preferences & workspace reset
│   │   └── commandPalette.js   # Keyboard shortcuts & quick search
│   ├── services/
│   │   └── ai/
│   │       └── index.js        # AI provider interface abstraction (BYOK)
│   └── utils/
│       └── helpers.js          # XSS escaping & toast notifications
├── tests/
│   ├── templates.test.js       # Template schema & integrity tests
│   ├── optimizer.test.js       # Local structural analysis tests
│   ├── storage.test.js         # Security & state persistence tests
│   └── helpers.test.js         # XSS sanitization tests
├── index.html                  # Semantic dashboard markup
├── style.css                   # Design tokens, themes & layout styles
├── LICENSE                     # Apache License 2.0
├── NOTICE                      # Project attribution notice
├── BRANDING.md                 # Brand & trademark guidelines
├── CONTRIBUTING.md             # Contribution rules & DCO guide
├── DCO.txt                     # Developer Certificate of Origin 1.1
├── SECURITY.md                 # Security & responsible disclosure policy
└── CODE_OF_CONDUCT.md          # Community guidelines
```

---

## 🔒 Security & BYOK Policy

- **Zero Secrets in Client Storage:** Pecut AI does not store raw API keys in browser `localStorage`.
- **Environment Driven:** Self-hosted setups configure AI providers through server environment variables (see `.env.example`).
- **No Telemetry / Tracker Leaks:** All prompt data stays local to your machine in the Community Edition.

---

## 📜 Governance & License

- **Source Code:** [Apache License 2.0](LICENSE)
- **Documentation:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Contributions:** Governed by [Developer Certificate of Origin 1.1](DCO.txt)
- **Brand & Logo:** Distinct from code license; see [BRANDING.md](BRANDING.md)
