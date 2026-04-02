# Tasks: Fix Iframe Targeting

**Input**: Design documents from `/specs/015-fix-iframe-targeting/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and shared interfaces needed by all user stories.

- [x] T001 Add `canvasNodeId?: string` field to `WebviewSession` interface in `src/shared/types.ts`
- [x] T002 [P] Add `sessionId?: string` to `EmbeddedWebViewProps` interface in `src/popup/Canvas/EmbeddedWebView.tsx`
- [x] T003 [P] Add `channelNonce?: string` prop to `EmbeddedWebViewProps` in `src/popup/Canvas/EmbeddedWebView.tsx` (defensive improvement from research task 3)

---

## Phase 2: Foundational (DOM Targeting Infrastructure)

**Purpose**: Core DOM attribute rendering that MUST be complete before any iframe targeting fix can work.

**⚠️ CRITICAL**: The `data-session-id` DOM attribute is the foundation for ALL three user story fixes.

- [x] T004 Render `data-session-id` attribute on the container div in `src/popup/Canvas/EmbeddedWebView.tsx` — add `data-session-id={sessionId}` to the outer `<div>` at line 160
- [x] T005 Pass `sessionId` from canvas node content to `EmbeddedWebView` in `src/popup/Canvas/CanvasNode.tsx` — in the `web-view` case (line 196-204), read `sessionId` from `webContent` and pass as prop
- [x] T006 Fix `postToIframe` method in `src/popup/services/toolRegistry.ts` — change selector from `[data-node-id="${sessionId}"]` to `[data-session-id="${sessionId}"]` (line 1163)

**Checkpoint**: Foundation ready — `data-session-id` is rendered on iframe containers, `postToIframe` uses it for targeting.

---

## Phase 3: User Story 1 - DAG Scrape Node Extraction Works Reliably (Priority: P1) 🎯 MVP

**Goal**: DAG scrape nodes reliably extract content from embedded webview iframes using session-ID-based targeting instead of fragile URL matching.

**Independent Test**: Run `execute_dag` with a scrape node pointing at any URL (including redirecting URLs) and verify extraction returns data without timeout.

### Implementation for User Story 1

- [x] T007 [US1] Replace URL-based iframe lookup with session-ID-based lookup in `waitForExtraction` method in `src/popup/services/toolRegistry.ts` — replace the `iframe[src="${url}"]` retry loop (lines 1251-1268) with `document.querySelector(`[data-session-id="${sessionId}"] iframe`)` followed by immediate `postMessage`
- [x] T008 [US1] Wire `canvasNodeId` into scrape node handler in `src/popup/services/toolRegistry.ts` — in the `scrape` case of `executeNodeWithWorker` (around line 863-902), after `browse_webview` returns, update the canvas node content to include `sessionId` from the browse result, so `EmbeddedWebView` re-renders with `data-session-id`
- [x] T009 [US1] Add `updateCanvasNode` callback mechanism to `ToolRegistry` class in `src/popup/services/toolRegistry.ts` — add a public `updateCanvasNode: ((nodeId: string, content: Record<string, unknown>) => void) | null` field, and wire it in `App.tsx` alongside the existing `addCanvasNode` wiring. Use it in the scrape handler to set `sessionId` on the canvas node content after session creation.
- [x] T010 [US1] Ensure `browse_webview` handler sets `canvasNodeId` on the created session in `src/popup/services/toolRegistry.ts` — when `browse_webview` is called from a scrape flow (detectable via existing `activeWebviewDAGNodes` or by adding a `canvasNodeId` parameter), set `session.canvasNodeId` so the session-to-node mapping is bidirectional

**Checkpoint**: At this point, DAG scrape nodes should extract content reliably. Test by running an `execute_dag` with a scrape node via CDP.

---

## Phase 4: User Story 2 - Webview Interactions Target Correct Iframe (Priority: P2)

**Goal**: `interact_webview` and `extract_webview_content` reliably target the correct iframe using session-ID-based `postToIframe`, even with multiple concurrent webviews.

**Independent Test**: Create a DAG with two browse nodes for different URLs followed by interact nodes, and verify each interaction targets only its own iframe.

### Implementation for User Story 2

- [x] T011 [US2] Verify `sendInteractionToIframe` in `src/popup/services/toolRegistry.ts` uses the fixed `postToIframe` method (line 1309) — it already calls `this.postToIframe(sessionId, ...)` which was fixed in T006, so confirm no additional changes needed
- [x] T012 [US2] Verify `sendExtractBySelector` in `src/popup/services/toolRegistry.ts` uses the fixed `postToIframe` method (line 1379) — it already calls `this.postToIframe(sessionId, ...)` which was fixed in T006, so confirm no additional changes needed
- [x] T013 [US2] Add defensive logging in `postToIframe` in `src/popup/services/toolRegistry.ts` — when container or iframe is not found, log the searched `sessionId` and list all `[data-session-id]` elements currently in the DOM to aid debugging

**Checkpoint**: Multi-iframe interaction scenarios should work correctly. Both `interact_webview` and `extract_webview_content` target the right iframe.

---

## Phase 5: User Story 3 - Navigate Back Targets Correct Iframe (Priority: P3)

**Goal**: `navigate_webview_back` reliably sends `NAVIGATE_BACK` to the correct iframe using session-ID-based targeting.

**Independent Test**: Browse a URL, click a link to navigate within the iframe, then call `navigate_webview_back` and verify it returns to the previous page.

### Implementation for User Story 3

- [x] T014 [US3] Verify `navigate_webview_back` handler uses the fixed `postToIframe` method in `src/popup/services/toolRegistry.ts` (line 626) — it already calls `this.postToIframe(sessionId, ...)` which was fixed in T006, so confirm `NAVIGATE_BACK` message reaches the correct iframe
- [x] T015 [US3] Verify `waitForNavigationBack` in `src/popup/services/toolRegistry.ts` (line 1322) correctly matches responses by nonce — confirm the nonce filter prevents cross-contamination when multiple webview sessions exist simultaneously

**Checkpoint**: Navigation back targets the correct iframe. All three user stories are now functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Build verification, edge case handling, and documentation.

- [x] T016 Run `npm run build` and verify no TypeScript compilation errors
- [x] T017 Run `npm run lint` and fix any linting issues
- [ ] T018 Verify backward compatibility — create an `open_web_view` canvas node (non-DAG) and confirm it renders without `data-session-id` and does not throw errors
- [ ] T019 Run quickstart.md validation via CDP — execute a DAG with a scrape node for `https://example.com` and verify extraction succeeds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion (T006 fix). US2 tasks are primarily verification since `postToIframe` fix from T006 covers them.
- **User Story 3 (Phase 5)**: Depends on Phase 2 completion (T006 fix). US3 is primarily verification.
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2. Core implementation work — new targeting logic + session wiring
- **User Story 2 (P2)**: Depends on Phase 2 (T006). Mostly verification that existing `postToIframe` callers work
- **User Story 3 (P3)**: Depends on Phase 2 (T006). Mostly verification that navigate_back works

### Within Each User Story

- Types before component rendering
- Component rendering before toolRegistry targeting fix
- Targeting fix before session wiring
- Session wiring before end-to-end verification

### Parallel Opportunities

- T001, T002, T003 can run in parallel (different files, no cross-dependencies)
- T004, T005, T006 can run partially in parallel: T004 and T006 in different files, T005 depends on T002's type change
- T011, T012 can run in parallel (verification tasks, same file but different methods)
- T014, T015 can run in parallel (verification tasks)

---

## Parallel Example: Phase 1 (Setup)

```text
# Launch all setup tasks together:
Task T001: "Add canvasNodeId to WebviewSession in src/shared/types.ts"
Task T002: "Add sessionId prop to EmbeddedWebViewProps in src/popup/Canvas/EmbeddedWebView.tsx"
Task T003: "Add channelNonce prop to EmbeddedWebViewProps in src/popup/Canvas/EmbeddedWebView.tsx"
```

## Parallel Example: Phase 2 (Foundational)

```text
# T004 and T006 in parallel (different concerns in different files):
Task T004: "Render data-session-id in EmbeddedWebView.tsx"
Task T006: "Fix postToIframe selector in toolRegistry.ts"
# Then T005 (depends on T002 from Phase 1):
Task T005: "Pass sessionId from CanvasNode to EmbeddedWebView"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T006)
3. Complete Phase 3: User Story 1 (T007-T010)
4. **STOP and VALIDATE**: Test scrape node extraction via CDP
5. Run `npm run build && npm run lint`

### Incremental Delivery

1. Setup + Foundational → DOM targeting infrastructure ready
2. Add User Story 1 → Scrape extraction works reliably (MVP!)
3. Add User Story 2 → Multi-iframe interactions work correctly
4. Add User Story 3 → Navigation back works correctly
5. Polish → Build passes, backward compatibility verified

### Key Risk: React Re-render Timing

T008 and T009 involve updating canvas node content after session creation. The React re-render must complete before `waitForExtraction` sends the `EXTRACT_CONTENT` message. The existing 100ms delay in the scrape handler (line 885) may need to be increased or replaced with a more reliable mechanism (e.g., waiting for the `data-session-id` attribute to appear in the DOM).
