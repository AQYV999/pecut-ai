# Pecut AI — Workspace Canvas Specification
**Date:** 2026-11-17  
**Status:** Approved by User  
**Author:** Pecut AI Architecture & Engineering  

---

## 1. Executive Summary & Intent

### 1.1 Intent & Problem Statement
Pecut AI currently functions as a prompt utility tool featuring a structured Builder, offline/online Optimizer, Context Profiles, and Multi-Step Workflow chains. However, prompt engineering and content creation are fundamentally iterative: users often converse with an AI, debate concepts, refine constraints ("make it punchier", "add 3 real-world examples"), and progressively craft a master prompt or deliverable.

### 1.2 Proposed Solution
Transform Pecut AI into an interactive **Workspace Canvas** inspired by modern dual-pane AI environments (ChatGPT Canvas / Claude Artifacts).
- **Left Pane:** Conversational multi-turn AI Chat powered by the user's active BYOK provider (Groq, Google Gemini, OpenRouter, OpenAI, or Local Ollama).
- **Right Pane:** Live Document / Canvas Editor where drafts and master prompts are authored, edited directly by the user, and updated from AI suggestions.
- **Collapsible Sidebar:** Multi-project / workspace switcher allowing users to manage distinct ongoing projects (e.g. "Landing Page Prompt", "Cold Email Generator", "Code Review Assistant") persisted in client-side storage.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
1. **Interactive Dual-Pane Workspace:** Split-view on desktop (resizable/responsive) with a chat panel on the left and a live document editor on the right.
2. **Multi-Turn Chat with History:** Full conversation memory per workspace, dispatching to `completeChat` using whichever BYOK provider/model is active.
3. **Seamless Canvas Interoperability:** One-click actions to "Insert into Canvas", "Replace Canvas", or "Send to Optimizer".
4. **Persistent Project Management:** Create, rename, delete, and switch between multiple workspaces stored locally in `localStorage`.
5. **Data Portability:** Export workspace as Markdown (`.md`) or full JSON backup, and import previous workspaces.
6. **Mobile Adaptability:** On narrow viewports (< 768px), seamlessly switch between Chat and Canvas views with a segmented toggle.

### 2.2 Non-Goals
1. **Real-time Multi-User Collaborative Editing (CRDTs / WebSockets):** Pecut AI is a client-first, zero-database application. Real-time co-editing between multiple browser tabs or devices via cloud sync is out of scope for this version.
2. **Server-Side Chat Storage:** No messages or document contents are stored on Vercel or any backend database.
3. **Heavy WYSIWYG Frameworks:** We will not import heavyweight editors like Quill, TinyMCE, or Slate; a clean, responsive textarea with syntax-friendly styling and Markdown export provides the fastest load times and zero dependency bloat.

### 2.3 Anti-Goals
- **No Cloud Lock-in or Cost:** Zero backend database subscriptions (no Firebase/Supabase needed).
- **No Performance Regressions:** Maintain Pecut AI's lightweight footprint (< 100KB gzipped).
- **No Breaking Changes:** Existing Builder, Optimizer, Profiles, and Flows continue to work unchanged.

---

## 3. Architecture & Alternatives Evaluated

### 3.1 Approaches Evaluated
1. **Approach A: Dedicated "Workspace Canvas" Tab (Selected)**
   - Add a new top-level tab in navigation: `[Workspace Canvas]`.
   - Dedicated split-view interface with collapsible workspace manager sidebar, chat stream, and live editor.
   - *Pros:* Cleanest UX, spacious layout, zero interference with existing tabs, feels like a professional IDE for prompts.
   - *Selected Reason:* User explicitly selected Approach A as the ideal workflow.

2. **Approach B: Floating Slide-Over Drawer Chat**
   - Add a floating chat assistant button over existing tabs.
   - *Trade-off:* Constrained screen real estate, clutters the Optimizer and Builder forms.

3. **Approach C: Single Session Ephemeral Canvas**
   - Single split-pane without workspace/project switching.
   - *Trade-off:* Restrictive; users cannot maintain separate contexts for different tasks.

---

## 4. Detailed Design & Specifications

### 4.1 Data Model (`src/modules/workspaceStorage.js`)
All workspaces are stored under the localStorage key `pecut_workspaces`:

```typescript
interface WorkspaceItem {
  id: string;               // e.g. "ws_1731839201_a8f9"
  title: string;            // e.g. "E-Commerce Copywriting"
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
  documentContent: string;  // The current canvas document/prompt text
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;
  contextProfileId?: string; // Optional attached persona ID
}

interface WorkspaceState {
  activeWorkspaceId: string | null;
  workspaces: WorkspaceItem[];
}
```

### 4.2 Storage API
- `loadWorkspaces(): WorkspaceItem[]`
- `saveWorkspace(item: WorkspaceItem): void`
- `deleteWorkspace(id: string): void`
- `getActiveWorkspace(): WorkspaceItem`
- `setActiveWorkspaceId(id: string): void`
- `exportWorkspacesJSON(): string`
- `importWorkspacesJSON(jsonString: string): boolean`

### 4.3 UI Layout & Components
```
+-----------------------------------------------------------------------------------------+
| [≡ Projects] |             CHAT PANE                 |        CANVAS / DOCUMENT         |
|--------------+---------------------------------------+----------------------------------|
| [+ New Doc]  | [Profile: Senior Engineer ▾]          | 📄 [Title Input: Project Name  ] |
| 📁 Project A | ------------------------------------- | -------------------------------- |
| 📁 Project B | AI: How can I help refine your prompt?| # Master Prompt                  |
| 📁 Project C |                                       | Role: Senior Data Architect...   |
|              | User: Add strict output formatting    |                                  |
|              |                                       | (Editable textarea with toolbar) |
|              | AI: Here is the updated structure:    | -------------------------------- |
|              | [📥 Push to Canvas] [📋 Copy]         | [⚡ Send to Optimizer]           |
|              |                                       | [📋 Copy Text] [⬇️ Export MD]   |
|              | [ Type your prompt/feedback... ] [Send|                                  |
+-----------------------------------------------------------------------------------------+
```

### 4.4 Chat Logic & Provider Integration
- Uses `completeChat()` from `src/services/ai/client.js`.
- Chat history is maintained and passed in `options.messages` (limited to last 10 turns to avoid token overflow).
- System prompt incorporates Pecut AI Canvas assistant instructions:
  - Specialize in prompt engineering, technical authoring, and content refining.
  - When outputting a prompt or document update, format it with clear headings so the user can easily review or push it to the Canvas.
- Error handling with auto-retry and friendly toast alerts.

---

## 5. Implementation Plan Summary
1. **Module `src/modules/workspaceStorage.js`:** Pure storage operations with unit tests.
2. **Module `src/modules/canvas.js`:** UI controller managing chat interaction, canvas updates, workspace switching, and export.
3. **HTML / CSS Integration:** Add `#workspaceCanvasView` tab, responsive split-pane styles, chat bubbles, and toolbar.
4. **Integration with Existing Services:** Wire active BYOK provider, topbar status, and "Send to Optimizer".
5. **Unit Tests:** Verify workspace CRUD, chat payload building, and export/import serialization.
6. **Build & Production Deployment:** Build assets and deploy to Vercel production.
