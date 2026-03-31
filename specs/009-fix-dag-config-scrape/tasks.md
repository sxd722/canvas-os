# Tasks: Fix DAG Config Initialization and Scrape-to-Webview Routing

**Input**: Design documents from `/specs/009-fix-dag-config-scrape/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested in the feature specification. Test tasks omitted per template guidance.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - LLM Config Available for DAG Nodes (Priority: P1) 🎯 MVP

**Goal**: Initialize the tool registry's `currentLLMConfig` on app startup and on settings save, so `llm_calc` DAG nodes can instantiate the LLM provider.

**Independent Test**: Configure an LLM API key in Settings, submit a prompt that generates an `llm_calc` node, verify the node succeeds and returns analysis content on the canvas.

### Implementation for User Story 1

- [x] T001 [US1] Import `setLLMConfig` from `'./services/toolRegistry'` in `src/popup/App.tsx`
- [x] T002 [US1] Add `toolRegistry.setLLMConfig(savedConfig)` inside the `loadData` function in `src/popup/App.tsx` — place after the existing `setConfig(savedConfig)` call (line ~53), only when `savedConfig` is not null/undefined
- [x] T003 [US1] Locate `handleSaveConfig` in `src/popup/App.tsx` and add `toolRegistry.setLLMConfig(newConfig)` after the config is persisted to storage — if `handleSaveConfig` does not exist, find the config save handler (may be inline or in a settings component) and add the call there

**Checkpoint**: `llm_calc` nodes should execute successfully when a valid LLM config exists, and fail gracefully with a clear error when no config is set.

---

## Phase 2: User Story 2 - Visual Scrape via Canvas Webview (Priority: P2)

**Goal**: Replace the `scrape` node's `SCRAPE_TAB` background message routing with a visual webview approach that calls `browse_webview` via `this.executeTool()`.

**Independent Test**: Submit a multi-URL comparison prompt, verify each URL opens as an embedded webview on the canvas, verify extraction results appear in the DAG node output.

### Implementation for User Story 2

- [x] T004 [US2] Replace the `scrape` node routing block in `executeNodeWithWorker` method in `src/popup/services/toolRegistry.ts` — remove the `chrome.runtime.sendMessage({ type: 'SCRAPE_TAB', ... })` Promise wrapper (lines ~861-886) and replace with: `const result = await this.executeTool({ name: 'browse_webview', arguments: { url: params.url, intent: 'extract page data for comparison', title: 'Scrape: ' + params.url } }); return result;`
- [x] T005 [US2] Update `[DAG]` console.log tracing for scrape node execution in `src/popup/services/toolRegistry.ts` — change the existing log entry from SCRAPE_TAB parameters to webview parameters (url, intent), update success log to show browse_webview result fields, update error log for webview failures

**Checkpoint**: Scrape nodes should open visible webviews on the canvas, with extracted content returned as node results available for downstream `llm_calc` nodes.

---

## Phase 3: Verification & Polish

**Purpose**: Build verification and final validation.

- [x] T006 Run `npm run build` and verify zero build errors in `src/popup/App.tsx` and `src/popup/services/toolRegistry.ts`
- [x] T007 Run `npx tsc --noEmit` and verify zero type errors (pre-existing test file warnings are acceptable)

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies — can start immediately. MVP scope.
- **User Story 2 (Phase 2)**: Independent of US1 (different file). Can be implemented in parallel.
- **Polish (Phase 3)**: Depends on both user stories being complete.

### Within Each User Story

- T001 (import) must complete before T002 and T003
- T002 and T003 are in the same file but different functions — can be done in either order
- T004 and T005 are in the same file, same if-block — implement sequentially

### Parallel Opportunities

- **Phase 1 (App.tsx) and Phase 2 (toolRegistry.ts) touch different files** — T001–T003 can run in parallel with T004–T005

---

## Parallel Example: User Story 1 + User Story 2

```bash
# Phase 1 (App.tsx) and Phase 2 (toolRegistry.ts) can execute simultaneously:
Agent A: "T001-T003: Add setLLMConfig calls in src/popup/App.tsx"
Agent B: "T004-T005: Replace scrape routing in src/popup/services/toolRegistry.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Add setLLMConfig initialization (T001–T003)
2. **STOP and VALIDATE**: Build passes, `llm_calc` nodes work with saved config
3. Config initialization alone fixes the blocking bug

### Incremental Delivery

1. Phase 1 (US1) → Config init works → Deploy/Demo (MVP!)
2. Phase 2 (US2) → Visual scraping works → Deploy/Demo
3. Phase 3 → Build verified → Ship

---

## Notes

- Two files modified: `src/popup/App.tsx` and `src/popup/services/toolRegistry.ts`
- No new files, no new directories, no new dependencies
- `setLLMConfig` is an existing public method — just needs to be called at lifecycle points
- `browse_webview` tool handler is self-contained (creates canvas nodes, manages iframe, performs extraction) — calling it from `executeNodeWithWorker` works without the `handleToolCall` wrapper
- The `SCRAPE_TAB` background handler remains in `src/background/index.ts` but is no longer called by DAG scrape nodes
- iframe blocking from e-commerce sites is acknowledged and deferred to a future fix
