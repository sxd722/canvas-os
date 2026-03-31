# Tasks: DAG Scrape and LLM Calc Node Support

**Input**: Design documents from `/specs/008-dag-scrape-llm-calc/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested in the feature specification. Test tasks omitted per template guidance.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - Scrape Web Pages Within a DAG (Priority: P1) 🎯 MVP

**Goal**: Enable the DAG execution engine to route `scrape` type nodes to the background script's `SCRAPE_TAB` handler, returning extracted page content as the node result.

**Independent Test**: Submit a prompt like "Compare prices from these two URLs" and verify that each URL's page content is captured and returned as a DAG node result on the canvas.

### Implementation for User Story 1

- [x] T001 [US1] Add `createLLMProvider` import at the top of `src/popup/services/toolRegistry.ts` (import from `../../shared/llm-provider`)
- [x] T002 [US1] Add `scrape` node routing if-block in `executeNodeWithWorker` method in `src/popup/services/toolRegistry.ts` — return a Promise that calls `chrome.runtime.sendMessage({ type: 'SCRAPE_TAB', url: params.url, selector: params.selector, waitMs: params.waitMs, timeout: params.timeout }, callback)`, resolve with response on `response.success === true`, reject with `response.error` on failure
- [x] T003 [US1] Add `[DAG]` console.log tracing for scrape node execution in `src/popup/services/toolRegistry.ts` — log entry with `nodeId`, `url`, `selector` params; log success with content length; log error with error message

**Checkpoint**: Scrape nodes should execute in a DAG plan, display scraped content on the canvas, and show `[DAG]` prefixed logs in Chrome DevTools console.

---

## Phase 2: User Story 2 - Aggregate Scraped Data with LLM (Priority: P2)

**Goal**: Enable the DAG execution engine to route `llm_calc` type nodes to the LLM provider, interpolating dependency results into the prompt template and returning the LLM's structured analysis.

**Independent Test**: Submit a prompt that requires comparing data from two URLs and verify the LLM returns a structured comparison result on the canvas.

### Implementation for User Story 2

- [x] T004 [US2] Add `llm_calc` node routing if-block in `executeNodeWithWorker` method in `src/popup/services/toolRegistry.ts` — validate `currentLLMConfig` exists (throw `'LLM configuration is required for llm_calc nodes'` if not), call `this.interpolateCodeWithDeps(node.params.prompt, depResults)` to substitute dependency results, instantiate provider with `createLLMProvider(currentLLMConfig)`, call `await provider.complete([{ role: 'user', content: interpolatedPrompt }], { model: params.model })`, return `result.content` on success, throw `result.error` on failure
- [x] T005 [US2] Add `[DAG]` console.log tracing for llm_calc node execution in `src/popup/services/toolRegistry.ts` — log entry with `nodeId`, `model` override; log success with response length; log error with error message

**Checkpoint**: LLM calc nodes should execute after their scrape dependencies complete, display the LLM's analysis on the canvas, and show `[DAG]` prefixed logs in Chrome DevTools console.

---

## Phase 3: Verification & Polish

**Purpose**: Build verification and final validation.

- [x] T006 Run `npm run build` and verify zero build errors in `src/popup/services/toolRegistry.ts`
- [x] T007 Run `npx tsc --noEmit` and verify zero type errors (pre-existing test file warnings are acceptable)
- [x] T008 Manual verification via Chrome DevTools on localhost:9222 — configure LLM API key, submit a multi-URL comparison prompt, verify `[DAG]` console logs show scrape node execution and llm_calc aggregation, verify canvas displays results

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies — can start immediately. MVP scope.
- **User Story 2 (Phase 2)**: Depends on US1 T001 (import must be present before llm_calc routing uses the provider). Should be implemented after Phase 1.
- **Polish (Phase 3)**: Depends on both user stories being complete.

### Within Each User Story

- T001 (import) must complete before T002 and T004
- T002 (scrape routing) and T003 (scrape logging) are in the same file but distinct edits — implement sequentially
- T004 (llm_calc routing) and T005 (llm_calc logging) are in the same file but distinct edits — implement sequentially

### Parallel Opportunities

- T002 + T003 are sequential (same if-block in same file)
- T004 + T005 are sequential (same if-block in same file)
- Phase 1 and Phase 2 share the same file (`toolRegistry.ts`) — cannot run in parallel

---

## Parallel Example: N/A

This feature modifies a single file (`src/popup/services/toolRegistry.ts`). All tasks are sequential within each phase. No parallel execution opportunities exist.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Add scrape routing (T001–T003)
2. **STOP and VALIDATE**: Build passes, scrape nodes work in DAG execution
3. Scrape nodes alone provide value — can extract content from multiple URLs in parallel

### Incremental Delivery

1. Phase 1 (US1) → Scrape works → Deploy/Demo (MVP!)
2. Phase 2 (US2) → LLM aggregation works → Deploy/Demo
3. Phase 3 → Build verified, manual test passed → Ship

---

## Notes

- Single file change: `src/popup/services/toolRegistry.ts`
- No new files, no new directories, no new dependencies
- All supporting infrastructure (SCRAPE_TAB handler, createLLMProvider, type definitions, interpolation utility) already exists
- The two new if-blocks go in `executeNodeWithWorker` before the `throw new Error('Unknown node type')` fallback
- Commit after each phase for clean git history
