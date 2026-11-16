# Pecut AI

**Think Better. Work Smarter. Move Faster.**

AI productivity & workflow workspace. This repository is being built toward a
production-ready beta per the master blueprint, in phases. **Do not assume a
feature exists unless it is documented as implemented below.**

## Status (Phase 0 â€” Audit & Hardening)

Implemented and working (frontend, local-only):
- Dashboard / Overview.
- Structured Prompt Builder with live preview, save, copy.
- Prompt Library (favorites, edit, duplicate, delete, import/export JSON).
- 22 curated templates with preview and "use in builder".
- Execution History (local).
- Command palette + keyboard shortcuts.
- Settings (theme/language/tone/format).

Hardening done in Phase 0:
- Repaired UTF-8/cp1252 mojibake in `index.html` and `script.js`.
- **Removed insecure browser API-key storage.** The old settings field claimed
  keys were "encrypted locally" but stored them in plain `localStorage`. That
  field and logic are gone; any legacy `apiKey`/`provider` is stripped on load.
- Replaced the Optimizer's **fabricated** "Clarity Score: 42% â†’ 94%" with an
  honest, deterministic local structural analysis (no AI, no fake scores).
- Split-agnostic Vite scaffold added (`package.json`, `vite.config.js`).

Simulated / NOT yet real (see roadmap):
- Prompt Optimizer runs a **rule-based local transform**, not an AI model.
- No authentication, no backend, no database. Data is in `localStorage`.
- No AI provider integration, no credit accounting, no billing.
- Pecut Flow (workflow engine) and Context Profiles are **not built yet**.

## Quick start (local dev)

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm run build    # production build to dist/
```

The app is plain HTML/CSS/ES modules; it also opens directly, but Vite is the
supported dev flow going forward.

## Security notes
- No secrets belong in the frontend. Provider keys are server-side only.
- See `.env.example` for the variables a future backend phase requires.
- AI-generated content must be treated as untrusted input and verified.

## Roadmap
See the master prompt: Phase 1 (backend/auth), Phase 2 (real AI core),
Phase 3 (Pecut Flow, Context Profiles), Phase 4 (monetization), Phase 5
(production readiness).
