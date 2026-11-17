# Workspace Canvas & Interactive Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive dual-pane "Workspace Canvas" in Pecut AI with interactive multi-turn AI chat on the left, an editable live prompt/content document on the right, and a collapsible project workspace manager in client storage.

**Architecture:** Client-side modular architecture with Vanilla JS ES modules. `workspaceStorage.js` handles atomic CRUD operations for multi-workspace states in `localStorage`. `canvas.js` orchestrates multi-turn chat interaction via `src/services/ai/client.js` (`completeChat`), debounced canvas auto-save, one-click "Apply to Canvas", "Send to Optimizer", and mobile segmented view toggling.

**Tech Stack:** Vanilla JavaScript (ES2022+), Vite, Node.js Native Test Runner (`node:test`), HTML5, CSS3, Vercel Serverless Proxy.

**Spec:** [`docs/superpowers/specs/2026-11-17-workspace-canvas-design.md`](file:///q:/Snap-Agent/Pecut%20AI/docs/superpowers/specs/2026-11-17-workspace-canvas-design.md)

## Global Constraints
- Client-first architecture: zero backend database costs, zero tokens stored on server.
- Workspace state stored in `localStorage` under `pecut_workspaces`.
- Zero new runtime NPM dependencies (pure Vanilla JS).
- Full compatibility with existing Pecut AI modules (Builder, Optimizer, Profiles, Flows).
- 100% test pass rate across all test files (`npm test`).
- Fast build (< 1s) with Vite.

## Review Focus
1. **Empty / First-run State:** When `localStorage` is empty, auto-initialize a starter workspace so the UI never renders null or empty panes.
2. **Missing API Key Guard:** If the user hasn't configured a key yet, show a polite prompt in the chat pane with a 1-click button to open the BYOK modal instead of throwing an unhandled network error.
3. **Context Window Protection:** Bounding chat memory sent to `completeChat` to the latest 10 messages, and localStorage chat history to the latest 50 messages.
4. **Debounced Auto-Save:** Auto-save document edits with a 400ms debounce to prevent localStorage thrashing.
5. **Mobile Responsiveness (< 768px):** Dual-pane gracefully transitions to a single-pane with a segmented toggle (`[💬 Chat] [📄 Canvas]`) and reduced container padding.

---

### Task 1: Workspace Storage Module (`src/modules/workspaceStorage.js`)

**Files:**
- Create: `src/modules/workspaceStorage.js`
- Create: `tests/workspaceStorage.test.js`

**Interfaces:**
- Produces:
  - `loadWorkspaces(): { activeWorkspaceId: string, workspaces: Array<WorkspaceItem> }`
  - `saveWorkspace(item: Partial<WorkspaceItem>): WorkspaceItem`
  - `createWorkspace(title?: string, initialDoc?: string): WorkspaceItem`
  - `deleteWorkspace(id: string): { activeWorkspaceId: string, workspaces: Array<WorkspaceItem> }`
  - `setActiveWorkspaceId(id: string): void`
  - `getActiveWorkspace(): WorkspaceItem`
  - `exportWorkspacesJSON(): string`
  - `importWorkspacesJSON(jsonString: string): boolean`

- [x] **Step 1: Write the failing tests in `tests/workspaceStorage.test.js`**
  Cover initialization, create, update, delete, active fallback, and JSON export/import.

- [x] **Step 2: Run test to verify it fails**
  Run: `node --test tests/workspaceStorage.test.js`
  Expected: FAIL with "Cannot find module '../src/modules/workspaceStorage.js'"

- [x] **Step 3: Implement `src/modules/workspaceStorage.js`**
  Implement localStorage persistence under `pecut_workspaces`, auto-initialization of default starter workspace, debounced storage sync, and serialization.

- [x] **Step 4: Run test to verify it passes**
  Run: `node --test tests/workspaceStorage.test.js`
  Expected: PASS (all tests pass)

- [x] **Step 5: Commit**
  ```bash
  git add src/modules/workspaceStorage.js tests/workspaceStorage.test.js
  git commit -m "feat(storage): implement workspaceStorage module with unit tests"
  ```

---

### Task 2: Workspace Canvas HTML & Dual-Pane CSS

**Files:**
- Modify: `index.html` (lines 35-75 sidebar nav, lines 400-800 view sections, command palette)
- Modify: `style.css` (dual-pane split layout, canvas toolbar, chat bubbles, mobile responsive queries)
- Modify: `src/modules/navigation.js` (add `'canvas': 'Workspace Canvas'` to view title map)

**Interfaces:**
- Consumes: `switchView('canvas')` from `src/modules/navigation.js`
- Produces: DOM elements `#view-canvas`, `#canvasSidebar`, `#canvasChatPane`, `#canvasDocPane`, `#canvasMobileToggle`

- [x] **Step 1: Add Canvas Nav Item & View Section in `index.html`**
  - Add `<a href="#canvas" class="nav-item" data-nav="canvas">` in the Workspace navigation group.
  - Add `<section id="view-canvas" class="view-section">` with full split-screen DOM (collapsible project sidebar, chat stream, message input, prompt document editor, action toolbar).
  - Add command palette entry `<div class="cmd-item" data-action="nav" data-target="canvas">`.

- [x] **Step 2: Add View Title Mapping in `src/modules/navigation.js`**
  Add `'canvas': 'Workspace Canvas'` to `titles` object in `src/modules/navigation.js`.

- [x] **Step 3: Add Dual-Pane Layout Styles in `style.css`**
  - Layout styles for `.workspace-canvas-container`, `.workspace-sidebar`, `.workspace-chat-pane`, `.workspace-doc-pane`.
  - Message styling (`.chat-msg-user`, `.chat-msg-assistant`, `.chat-msg-apply-btn`).
  - Mobile responsive rules for `@media (max-width: 768px)` with segmented toggle and reduced content padding.

- [x] **Step 4: Verify test suite and build**
  Run: `npm test && npm run build`
  Expected: All tests pass, build compiles cleanly.

- [x] **Step 5: Commit**
  ```bash
  git add index.html style.css src/modules/navigation.js
  git commit -m "feat(ui): add workspace canvas markup, navigation mapping, and dual-pane styles"
  ```

---

### Task 3: Canvas UI Controller & Interactive Chat Loop (`src/modules/canvas.js`)

**Files:**
- Create: `src/modules/canvas.js`
- Modify: `src/main.js` (initialize canvas controller)

**Interfaces:**
- Consumes:
  - `loadWorkspaces`, `saveWorkspace`, `createWorkspace`, `deleteWorkspace`, `getActiveWorkspace`, `setActiveWorkspaceId` from `src/modules/workspaceStorage.js`
  - `completeChat`, `getActiveProviderInfo` from `src/services/ai/client.js`
  - `showToast` from `src/utils/helpers.js`
- Produces: `initCanvas(): void`, `renderCanvas(): void`, `sendChatMessage(): Promise<void>`

- [x] **Step 1: Implement `src/modules/canvas.js`**
  - Render workspace project list in sidebar with "+ New Workspace", rename, and delete actions.
  - Render active workspace title, document editor with debounced auto-save (400ms).
  - Render chat history stream with markdown-friendly formatting.
  - Handle message submission:
    * Check if provider has valid key; if not, render friendly message with button to trigger `openAIModal()`.
    * Append user message and loading indicator.
    * Call `completeChat()` passing bounded history (`messages.slice(-10)`), with persona-infused system prompt.
    * Render AI response with "📥 Apply to Canvas" and "📋 Copy" action buttons.
  - Implement "📥 Apply to Canvas": appends or replaces document content with toast feedback.
  - Implement mobile segmented toggle (`[💬 Chat] | [📄 Canvas]`).
  - Wire export/download as Markdown (`.md`).

- [x] **Step 2: Wire `initCanvas()` in `src/main.js`**
  Import `initCanvas` and call it during application startup.

- [x] **Step 3: Verify tests and compile build**
  Run: `npm test && npm run build`
  Expected: All tests pass, build succeeds with 0 errors.

- [x] **Step 4: Commit**
  ```bash
  git add src/modules/canvas.js src/main.js
  git commit -m "feat(canvas): implement interactive multi-turn chat controller and document editor"
  ```

---

### Task 4: Integration with Existing Features ("Send to Optimizer" & Context Profiles)

**Files:**
- Modify: `src/modules/canvas.js`
- Modify: `src/modules/optimizer.js` (support pre-filling prompt from external triggers)

**Interfaces:**
- Consumes:
  - `switchView('optimizer')` from `src/modules/navigation.js`
  - Context profiles from `appState.profiles` in `src/modules/storage.js`
- Produces: Seamless cross-tab workflow: Canvas -> Optimizer -> Export.

- [x] **Step 1: Implement "⚡ Send to Optimizer"**
  - When clicking "Send to Optimizer" in Canvas toolbar, populate `#optimizerPromptInput` (or active optimizer textarea), switch view to `optimizer`, and trigger `showToast('Prompt sent to Optimizer!')`.

- [x] **Step 2: Implement Context Profile Selector in Canvas Header**
  - Render dropdown of available profiles (`Senior Engineer`, `Growth Marketer`, etc.) in chat pane.
  - Persist chosen profile on the workspace item (`workspace.contextProfileId`).
  - Automatically inject the persona's role, tone, and constraints into the chat assistant's system prompt.

- [x] **Step 3: Run full test suite**
  Run: `npm test`
  Expected: 33+ tests pass with 0 failures.

- [x] **Step 4: Commit**
  ```bash
  git add src/modules/canvas.js src/modules/optimizer.js
  git commit -m "feat(integration): connect canvas with optimizer and context profile personas"
  ```

---

### Task 5: Production Build & Vercel Universal Deployment

**Files:**
- All workspace files from Tasks 1-4.

- [x] **Step 1: Run comprehensive tests & production build**
  Run: `npm test && npm run build`
  Expected: 100% test pass rate, bundle compiled into `dist/`.

- [x] **Step 2: Deploy to Vercel production**
  Run: `npx vercel --prod --yes`
  Expected: Deployment succeeds, aliased to `https://pecut-ai-three.vercel.app`.

- [x] **Step 3: Push all commits to GitHub main branch**
  Run: `git push origin main`
  Expected: Pushed cleanly.

- [x] **Step 4: Verify live deployment in browser**
  Verify that `https://pecut-ai-three.vercel.app` loads the new Workspace Canvas tab, creates workspaces, chats with AI, and updates canvas.
