# Tasks: Fix Iframe Targeting ID Mismatch

**Input**: Design documents from `/specs/017-fix-iframe-id-mismatch/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Not explicitly requested in spec. No test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/` at repository root
- This feature modifies 2 existing files: `src/popup/services/toolRegistry.ts` and `src/popup/App.tsx`

---

## Phase 1: Setup

**Purpose**: No project setup needed — this is a bug fix modifying existing files. Verify build environment works.

- [x] T001 Run `npm run build` and `npm run lint` to verify current codebase compiles cleanly before making changes

---

## Phase 2: Foundational — postToIframe Lookup Strategy (Blocking Prerequisite)

**Purpose**: The core lookup function `postToIframe` must support `canvasNodeId` as primary lookup before any user story can use it. All other iframe targeting functions delegate to `postToIframe`.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add optional `canvasNodeId` parameter to `postToIframe` in `src/popup/services/toolRegistry.ts` (~line 1173): when `canvasNodeId` is provided, query `[data-node-id="${canvasNodeId}"]` first; if not found or omitted, fall back to existing `[data-session-id="${sessionId}"]` lookup. Update the warning log to indicate which lookup strategy was used.

- [x] T003 Add optional `canvasNodeId` parameter to `waitForExtraction` in `src/popup/services/toolRegistry.ts` (~line 1193): in the `tryFindAndSend` retry loop (~line 1267), when `canvasNodeId` is provided, query `[data-node-id="${canvasNodeId}"]` first instead of `[data-session-id="${sessionId}"]`; on fallback call to `this.postToIframe` (~line 1282), pass `canvasNodeId` through. Update log messages to indicate lookup strategy.

- [x] T004 [P] Add optional `canvasNodeId` parameter to `sendInteractionToIframe` in `src/popup/services/toolRegistry.ts` (~line 1292): pass it through to `this.postToIframe` call (~line 1325).

- [x] T005 [P] Add optional `canvasNodeId` parameter to `sendExtractBySelector` in `src/popup/services/toolRegistry.ts` (~line 1368): pass it through to `this.postToIframe` call (~line 1395).

**Checkpoint**: All four iframe helper functions now accept `canvasNodeId` with `data-node-id` primary lookup and `data-session-id` fallback. User story callers can now thread `canvasNodeId` through.

---

## Phase 3: User Story 1 — DAG Scrape Nodes Successfully Extract Content (Priority: P1) 🎯 MVP

**Goal**: When a DAG scrape node executes and calls browse_webview, the canvas node ID is passed to the extraction system so the iframe is found on the first lookup attempt.

**Independent Test**: Execute a DAG with a scrape node via CDP (ToolTester) and verify extraction results are returned instead of timing out. Check console for `[ToolRegistry] waitForExtraction | found iframe by nodeId`.

### Implementation for User Story 1

- [x] T006 [US1] In `browse_webview` handler in `src/popup/services/toolRegistry.ts` (~line 410): extract `canvasNodeId` from `call.arguments.canvasNodeId`, and when provided, pass it as the 6th argument to `this.waitForExtraction` (~line 486). Also call `this.webviewSessions.updateSession(session.id, { canvasNodeId })` (~line 422-424) so subsequent interact/extract calls can retrieve it.

- [x] T007 [US1] In `interact_webview` handler in `src/popup/services/toolRegistry.ts` (~line 534): after retrieving the session (~line 546), read `session.canvasNodeId` and pass it to `this.sendInteractionToIframe` (~line 565) and both `this.waitForExtraction` calls (~lines 588, 595).

- [x] T008 [US1] In `extract_webview_content` handler in `src/popup/services/toolRegistry.ts` (~line 669): after retrieving the session (~line 680), read `session.canvasNodeId` and pass it to `this.sendExtractBySelector` (~line 696).

- [x] T009 [US1] In `navigate_webview_back` handler in `src/popup/services/toolRegistry.ts` (~line 615): after retrieving the session (~line 622), read `session.canvasNodeId` and pass it to `this.postToIframe` (~line 631) and `this.waitForExtraction` (~line 648).

- [x] T010 [US1] Add `canvasNodeId?: string` to the `WebviewSession` interface in `src/shared/types.ts` so TypeScript recognizes the new field.

**Checkpoint**: DAG scrape nodes should now successfully extract content. The scrape handler (toolRegistry.ts:873) already passes `canvasNodeId` to `executeTool` (line 898), and Phase 2 + these tasks complete the chain from creation → browse_webview → waitForExtraction → postToIframe → DOM lookup.

---

## Phase 4: User Story 2 — Browse Webview Tool Targets Correct Iframe (Priority: P2)

**Goal**: When browse_webview is invoked directly from the chat UI (not via scrape node), the canvas node ID is propagated into the tool call so the extraction message reaches the correct iframe.

**Independent Test**: Send "Open https://example.com" in the chat popup and verify the webview loads and extracts content. Check console for `found iframe by nodeId`.

### Implementation for User Story 2

- [x] T011 [US2] In `handleToolCall` in `src/popup/App.tsx` (~line 166): after creating the canvas node with `id: generateId()` (~line 172), inject `canvasNodeId: webViewNode.id` into `toolCall.arguments` before calling `toolRegistry.executeTool(toolCall)` (~line 200).

**Checkpoint**: Chat-initiated browse_webview now passes canvas node ID through the full chain. Combined with Phase 2 and US1 changes, extraction should succeed.

---

## Phase 5: User Story 3 — Scrape Node Passes Canvas Node ID Through (Priority: P3)

**Goal**: Verify the scrape handler already passes `canvasNodeId` to browse_webview (it does — toolRegistry.ts:898), and ensure the session writeback still works for completeness.

**Independent Test**: Run a scrape node and verify that `canvas_node_id` appears in the browse_webview call arguments via console logs (`[DAG] browse_webview session created | ... canvasNodeId=dag-node-...`).

### Implementation for User Story 3

- [x] T012 [US3] Verify that the scrape handler in `src/popup/services/toolRegistry.ts` (~line 892) already passes `canvasNodeId` in the `arguments` object to `this.executeTool`. Confirm the existing session ID writeback (~line 904-907) still works alongside the new `canvasNodeId` flow. No code change expected — this is a verification task.

- [x] T013 [US3] Verify the `browse_webview` tool schema in `src/popup/services/toolRegistry.ts` (the tool definition with `description` and `parameters`) includes `canvasNodeId` as an optional string parameter so the LLM knows it can pass it.

**Checkpoint**: The scrape-to-browse chain is fully verified. Canvas node ID flows from scrape handler creation → browse_webview arguments → waitForExtraction → DOM lookup.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, cleanup, and backward compatibility verification.

- [x] T014 Run `npm run build` and `npm run lint` to verify no compilation or lint errors after all changes.
- [x] T015 Verify backward compatibility: ensure that calls to `postToIframe`, `waitForExtraction`, `sendInteractionToIframe`, and `sendExtractBySelector` without `canvasNodeId` still fall back to `data-session-id` lookup (the default parameter behavior).
- [x] T016 Run `npm test` to ensure existing tests pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify build
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — enables DAG scrape extraction
- **User Story 2 (Phase 4)**: Depends on Foundational — enables chat browse extraction
- **User Story 3 (Phase 5)**: Depends on Foundational — verification only
- **Polish (Phase 6)**: Depends on all user stories

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 (postToIframe changes). No dependency on US2/US3.
- **User Story 2 (P2)**: Depends on Phase 2 (postToIframe changes). No dependency on US1/US3.
- **User Story 3 (P3)**: Depends on Phase 2 (postToIframe changes). No dependency on US1/US2.

All three user stories are independent after Phase 2 completes.

### Within Each Phase

- Phase 2: T003 depends on T002 (waitForExtraction calls postToIframe). T004 and T005 are parallel.
- Phase 3: T007, T008, T009 all depend on T002-T005 (Phase 2) and T010. T010 can run in parallel with T006.
- Phase 4: T011 depends on Phase 2 only.
- Phase 5: T012, T013 depend on Phase 3 (scrape handler changes).

### Parallel Opportunities

- T004 and T005 can run in parallel (different functions, both call postToIframe)
- T010 can run in parallel with T006-T009 (different file: types.ts vs toolRegistry.ts)
- US1, US2, US3 can be worked on in parallel by different developers after Phase 2

---

## Parallel Example: Phase 2 Foundational

```text
# Step 1: T002 first (postToIframe — core lookup)
# Step 2: T003 (waitForExtraction — depends on T002 signature)
# Step 3 (parallel): T004 + T005 (sendInteraction + sendExtract — both call postToIframe)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Verify build
2. Complete Phase 2: Foundational (T002-T005)
3. Complete Phase 3: User Story 1 (T006-T010)
4. **STOP and VALIDATE**: Run a DAG scrape node via CDP and verify extraction succeeds
5. This fixes the primary failure mode

### Incremental Delivery

1. Phase 2 → Core lookup fix ready
2. Add Phase 3 (US1) → DAG scrape extraction works → **MVP**
3. Add Phase 4 (US2) → Chat browse extraction works
4. Phase 5 (US3) → Verify scrape chain completeness
5. Phase 6 → Polish and backward compatibility check

---

## Notes

- All changes are in 2 files: `src/popup/services/toolRegistry.ts` and `src/popup/App.tsx`, plus `src/shared/types.ts` for the interface update
- No new dependencies, no new files, no DOM changes
- `data-node-id` attribute already exists on all iframe containers (EmbeddedWebView.tsx:161)
- Backward compatibility is maintained via optional parameters with session ID fallback
