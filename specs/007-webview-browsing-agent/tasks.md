# Tasks: Interactive Webview Browsing Agent

**Input**: Design documents from `/specs/007-webview-browsing-agent/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared types, manifest entries, and content script that all user stories depend on.

- [ ] T001 Add WebviewSession, InteractiveElement, PageExtraction, NavigationEntry, BrowsingIntent, WebviewStatus, ElementType types and PopupToIframeMessage / IframeToPopupMessage message protocol types to `src/shared/types.ts`
- [ ] T002 [P] Add `'webview-browse' | 'webview-interact' | 'webview-extract'` to DAGNodeType union and BrowseDAGNodeParams interface to `src/shared/dagSchema.ts`
- [ ] T003 [P] Create TF-IDF scoring engine in `src/popup/services/semanticExtractor.ts` — implement tokenize(), computeTfIdf(), cosineSimilarity(), scoreElements(intent: string, elements: Array<{text: string, description: string}>): Array<{element, relevanceScore}>, and extractTopN(intent, elements, n=15). Pure JS, zero dependencies.
- [ ] T004 Create webview bridge content script in `src/content/webview_bridge.js` — listens for postMessage commands (EXTRACT_CONTENT, INTERACT_ELEMENT, NAVIGATE_BACK, GET_PAGE_STATUS, EXTRACT_BY_SELECTOR), extracts interactive elements from DOM (links, buttons, inputs, selects, clickable divs) with CSS selectors and XPath, performs click/fill/select actions, calls history.back(), sends results back via postMessage. Must generate unique element IDs and compute bounding rects.
- [ ] T005 Register webview_bridge.js in manifest content_scripts with `"all_frames": true`, `"match_origin_as_fallback": true`, and `"run_at": "document_idle"` — update `vite.config.ts` or manifest source to include this entry. Also ensure `host_permissions` includes `"<all_urls>"` for cross-origin iframe access.

**Checkpoint**: Types, content script, and scoring engine ready — all downstream work can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service layer that ALL user stories depend on — tool definitions, session hook, and postMessage bridge.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T006 Create useWebviewSessions hook in `src/popup/hooks/useWebviewSessions.ts` — manages Map<string, WebviewSession> in React state, exposes createSession(url, intent): WebviewSession, getSession(id): WebviewSession | undefined, updateSession(id, partial): void, closeSession(id): void, incrementInteraction(id): boolean (returns false if max reached), pushNavigationEntry(id, entry): void, popNavigationEntry(id): NavigationEntry | undefined. Sessions are in-memory only, no chrome.storage.

- [ ] T007 Extend EmbeddedWebView.tsx in `src/popup/Canvas/EmbeddedWebView.tsx` — add postMessage listener (window.addEventListener('message', ...)) that validates nonce and dispatches IframeToPopupMessage responses (CONTENT_RESPONSE, INTERACTION_RESULT, NAVIGATION_COMPLETE, PAGE_STATUS, EXTRACT_RESULT). Add sendMessageToIframe(message: PopupToIframeMessage) that posts to iframe contentWindow. Expose these via a ref callback or context so tool handlers can communicate with the iframe. Track channelNonce per iframe instance.

- [ ] T008 Add 4 new tool definitions to toolRegistry.ts in `src/popup/services/toolRegistry.ts` — register `browse_webview`, `interact_webview`, `navigate_webview_back`, `extract_webview_content` in toolDefinitions array following existing pattern (name, description, parameters JSON Schema). Add stub handlers for each that will be implemented in US1 phase. These tool definitions must be included in the tools array sent to the LLM API.

- [ ] T009 Add webview DAG node type handlers to executeNodeWithWorker in `src/popup/services/toolRegistry.ts` — add cases for `'webview-browse'`, `'webview-interact'`, `'webview-extract'` that delegate to the corresponding tool handlers. Each case should extract BrowseDAGNodeParams from node.params and call the appropriate handler.

**Checkpoint**: Foundation ready — session management, postMessage bridge, and tool stubs are in place. User story implementation can begin.

---

## Phase 3: User Story 1 — Interactive Webview Browsing with Semantic Extraction (Priority: P1) 🎯 MVP

**Goal**: LLM can open webviews, extract interactive elements via TF-IDF, click/navigate elements, go back, and extract targeted content. This is the complete browsing agent loop.

**Independent Test**: Ask LLM "Compare MacBook Pro prices between Canada and China" → verify webview nodes appear on canvas, elements are extracted and returned to LLM, LLM can click elements and navigate, DAG updates in real-time.

### Implementation for User Story 1

- [ ] T010 [US1] Implement `browse_webview` tool handler in `src/popup/services/toolRegistry.ts` — handler creates a WebviewSession via useWebviewSessions hook (generate sessionId = "webview-" + Date.now(), channelNonce = crypto.randomUUID()), sends postMessage EXTRACT_CONTENT with intent to iframe, waits for CONTENT_RESPONSE (timeout 10s), runs semanticExtractor.scoreElements() on extracted elements, returns { session_id, status, url, title, extraction: PageExtraction }. Handle blocked/error cases per browse_webview contract.

- [ ] T011 [US1] Implement `interact_webview` tool handler in `src/popup/services/toolRegistry.ts` — handler validates session exists via useWebviewSessions, checks interactionCount < maxInteractions, sends INTERACT_ELEMENT postMessage to iframe, waits for INTERACTION_RESULT (timeout 5s), if navigated waits for NAVIGATION_COMPLETE then re-extracts, increments interactionCount, returns { success, new_url, navigated, extraction }. Handle all error cases per interact_webview contract.

- [ ] T012 [US1] Implement `navigate_webview_back` tool handler in `src/popup/services/toolRegistry.ts` — handler validates session exists and has navigationHistory.length > 1, sends NAVIGATE_BACK postMessage, waits for NAVIGATION_COMPLETE (timeout 10s), pops last NavigationEntry, re-extracts content with session.intent, returns { success, url, title, extraction }. Handle error cases per navigate_webview_back contract.

- [ ] T013 [US1] Implement `extract_webview_content` tool handler in `src/popup/services/toolRegistry.ts` — handler validates session in loaded/interacting status, sends EXTRACT_BY_SELECTOR postMessage with selector, waits for EXTRACT_RESULT, returns { success, data, selector, target, match_count }. Handle invalid selector and not-found cases per extract_webview_content contract.

- [ ] T014 [US1] Integrate webview session state into App.tsx in `src/popup/App.tsx` — import useWebviewSessions hook, initialize session state, wire browse_webview tool call to also create a canvas node of type 'web-view' with { url, title, status, sessionId }, wire interact_webview/navigate_webview_back/extract_webview_content to update the corresponding canvas node's content. Add these tool names to the handleToolCall switch/case alongside existing open_web_view, execute_dag, read_artifact_content handlers. Ensure the agentic loop in handleSendMessage includes these new tools.

- [ ] T015 [US1] Update system prompt in App.tsx handleSendMessage in `src/popup/App.tsx` — add instructions for webview browsing tools: "You have webview browsing tools available. When the user asks you to research or compare information from websites: (1) Call browse_webview to open URLs and extract interactive elements, (2) Call interact_webview to click links or fill forms, (3) Call navigate_webview_back if you went to the wrong page, (4) Call extract_webview_content to pull specific data using CSS selectors. Each browse_webview returns elements with relevance scores — use the highest-scored elements first."

- [ ] T016 [US1] Verify `npm run build` passes with all changes and `npx tsc --noEmit` reports zero type errors across all modified and new files.

**Checkpoint**: At this point, User Story 1 should be fully functional — LLM can browse, navigate, and extract content through webviews. Test by asking "Compare MacBook Pro prices between Canada and China" via CDP on port 9222.

---

## Phase 4: User Story 2 — DAG Visualization of Browsing Workflow (Priority: P2)

**Goal**: During browsing, a DAG appears on the canvas representing the multi-step workflow with real-time status updates (pending → running → success/error).

**Independent Test**: Trigger a multi-step browsing task → verify DAG nodes appear with correct dependencies, statuses update as each step completes, failed nodes show error status and skip dependents.

### Implementation for User Story 2

- [ ] T017 [US2] Add webview-browse, webview-interact, webview-extract labels and icons to DAGNode.tsx in `src/popup/Canvas/DAGNode.tsx` — extend typeLabels map: `'webview-browse': 'Webview Browse'`, `'webview-interact': 'Webview Interact'`, `'webview-extract': 'Webview Extract'`. Add corresponding icons (globe for browse, cursor-click for interact, data-extraction for extract). Style them with distinct colors matching the webview theme.

- [ ] T018 [US2] Implement automatic DAG generation for webview browsing tasks in `src/popup/services/toolRegistry.ts` — when browse_webview is called, generate a DAG plan with nodes: webview-browse (initial URL load), webview-interact (navigation steps), webview-extract (final data extraction). Wire this into the existing notifyDAGExecution flow so the DAG appears on canvas and updates as each tool handler completes. The DAG should reflect the dependency chain: browse → interact(s) → extract.

- [ ] T019 [US2] Wire DAG node status updates from webview tool handlers in `src/popup/services/toolRegistry.ts` — when browse_webview completes, mark its DAG node as 'success'; when interact_webview completes, mark its node; when a navigation fails, mark node as 'error' and dependent nodes as 'skipped'. Use existing notifyDAGExecution(planId, nodes, status) mechanism.

- [ ] T020 [US2] Verify DAG renders correctly on canvas with all three webview node types visible, status transitions in real-time, and error propagation to dependent nodes. Test by triggering a browsing task and observing the DAG via CDP on port 9222.

**Checkpoint**: User Stories 1 AND 2 should both work — browsing agent with visual DAG progress tracking.

---

## Phase 5: User Story 3 — Semantic Content Extraction Optimization (Priority: P3)

**Goal**: TF-IDF extraction reduces page content sent to LLM by ≥80% vs raw HTML. Extraction returns only relevant elements for the stated intent, adapting to page navigation.

**Independent Test**: Load a webview → verify extraction payload size < 2000 tokens vs raw HTML, verify returned elements are relevant to intent, verify re-extraction adapts after navigation.

### Implementation for User Story 3

- [ ] T021 [US3] Add extraction quality metrics to semanticExtractor.ts in `src/popup/services/semanticExtractor.ts` — add computePayloadSize(extraction: PageExtraction): number to estimate token count, add computeReductionRatio(extraction, rawHtmlLength): number to measure compression. Add heuristic fallback: if TF-IDF yields < 3 elements with relevanceScore > 0.2, fall back to extracting page headings, meta description, and first paragraph as summary. Ensure extraction always returns at minimum a page summary even when no relevant elements found.

- [ ] T022 [US3] Enhance webview_bridge.js content script in `src/content/webview_bridge.js` — add page summary extraction to EXTRACT_CONTENT handler: extract document.title, meta description, all h1/h2/h3 headings, and first paragraph text. Include these in CONTENT_RESPONSE as part of the PageExtraction.summary field. This provides context even when TF-IDF finds no matching elements.

- [ ] T023 [US3] Verify extraction quality end-to-end — load apple.ca via browse_webview with intent "find MacBook Pro prices", confirm: (1) returned extraction contains MacBook Pro-related elements, (2) payload is < 2000 tokens vs raw page HTML, (3) re-extraction after navigation returns updated elements for the new page. Test via CDP toolTester.

**Checkpoint**: All three user stories are independently functional. Semantic extraction is optimized and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [ ] T024 [P] Add interaction loop guard in App.tsx `src/popup/App.tsx` — extend the usedTools Set pattern to also track webview interaction counts per session. If a session exceeds maxInteractions (default 10), inject a system message telling the LLM "Session {id} has reached its interaction limit. Summarize what you have found so far."

- [ ] T025 [P] Add blocked-webview fallback handling in EmbeddedWebView.tsx `src/popup/Canvas/EmbeddedWebView.tsx` — when iframe receives X-Frame-Options blocked signal, update WebviewSession status to 'blocked', return structured error to LLM with "Site blocks iframe embedding" message, and provide a "Open in new tab" link in the canvas node.

- [ ] T026 [P] Add node type labels to DAGNode.tsx for quick visual identification in `src/popup/Canvas/DAGNode.tsx` — ensure webview-browse shows URL hostname, webview-interact shows action description, webview-extract shows target description in the node title area.

- [ ] T027 Verify `npm run build` passes, `npx tsc --noEmit` passes with zero errors, and the full E2E flow works via CDP: "Compare MacBook Pro prices between Canada and China" produces webview nodes, DAG, navigation, and a comparison table in chat.

- [ ] T028 Run quickstart.md validation — follow the quickstart guide step-by-step to confirm the E2E demo works as documented.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — core browsing agent loop
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs working tool handlers to generate DAG)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (needs working extraction to optimize)
- **Polish (Phase 6)**: Depends on Phases 3-5

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 — NO dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 tool handlers being implemented (needs hooks into tool execution for DAG generation)
- **User Story 3 (P3)**: Depends on US1 extraction pipeline being functional (optimizes existing extraction)

### Within Each Phase

- Types before services (Phase 1: T001 → T003/T004)
- Session hook before tool handlers (Phase 2: T006 → T008)
- Tool definitions before handler implementations (Phase 2: T008 → Phase 3: T010-T013)
- Handlers before App.tsx integration (Phase 3: T010-T013 → T014)

### Parallel Opportunities

- Phase 1: T002 and T003 can run in parallel (different files)
- Phase 3: T010, T011, T012, T013 can partially overlap (different handlers in same file — coordinate carefully)
- Phase 5: T021, T022 can run in parallel (different files)
- Phase 6: T024, T025, T026 can run in parallel (different files)

---

## Parallel Example: Phase 1

```bash
# These can run simultaneously (different files):
Task T002: "Add DAG node types to src/shared/dagSchema.ts"
Task T003: "Create TF-IDF scoring engine in src/popup/services/semanticExtractor.ts"
# Then after T001 types are ready:
Task T004: "Create webview bridge content script in src/content/webview_bridge.js"
Task T005: "Register content script in manifest"
```

## Parallel Example: Phase 6

```bash
# These can run simultaneously (different files):
Task T024: "Add interaction loop guard in src/popup/App.tsx"
Task T025: "Add blocked-webview fallback in src/popup/Canvas/EmbeddedWebView.tsx"
Task T026: "Add node type labels in src/popup/Canvas/DAGNode.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types, content script, scoring engine)
2. Complete Phase 2: Foundational (session hook, postMessage bridge, tool stubs)
3. Complete Phase 3: User Story 1 (4 tool handlers + App.tsx integration + system prompt)
4. **STOP and VALIDATE**: Test browsing loop end-to-end via CDP
5. Demo if ready — LLM can browse, navigate, and extract

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **MVP!** (LLM browsing agent)
3. Add User Story 2 → Test independently → DAG visualization
4. Add User Story 3 → Test independently → Optimized extraction
5. Polish → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- All code must pass `npm run build` and `npx tsc --noEmit` after each phase
- All new files follow MV3 CSP compliance (no eval, no remote CDNs)
- Webview sessions are ephemeral (React state only, no chrome.storage)
- Content script `all_frames: true` is the key enabler for cross-origin iframe DOM access
