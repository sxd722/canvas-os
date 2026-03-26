# Tasks: CanvasOS Agentic IDE Upgrade

**Branch**: `002-agentic-ide-features`
**Input**: Design documents from `/specs/002-agentic-ide-features/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Self-tests using Chrome Remote Debugging (CDP) on port 9222

**Organization**: Tasks grouped by user story for independent implementation

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- All tasks include CDP self-test requirements

## Path Conventions

- **Chrome Extension**: `src/popup/`, `src/background/`, `src/content/`, `src/sandbox/`, `src/shared/`, `public/`
- Build output: `dist/`
- Test via CDP on `localhost:9222`

---

## Phase 0: Critical Fixes (BLOCKING)

**Purpose**: Fix current build failures and ensure DAG visualization renders correctly
**Priority**: MUST complete before any other work

- [X] T0001 Debug and fix current Vite/React TypeScript build failures
  - **Files**: `src/popup/Canvas/CanvasNode.tsx`, `src/popup/Canvas/DAGNode.tsx`, `src/popup/Chat/MentionDropdown.tsx`, `src/popup/services/dagExecutor.ts`, `src/popup/services/toolRegistry.ts`
  - **Self-Test**: Run `npm run build`, verify 0 errors

**Checkpoint**: Build passes

---

## Phase 0.5: execute_dag Worker Thread Implementation (BLOCKING)

**Purpose**: Implement execute_dag function with worker threads for concurrent node execution
**Priority**: MUST complete before DAG visualization work
**Context**: User requested: "implement execute_dag function tool_calls. The function executes each node in the dag. Implement the web op, llm call and js execution, each spawn a worker thread that executes the corresponding task: invoke apis, run js in a sandbox etc."

- [X] T0002 [US1] Create Web Worker infrastructure for DAG node execution in `src/popup/workers/dagWorker.ts`
  - **Details**: Create base worker thread manager that can spawn and communicate with specialized workers
  - **Self-Test**: In CDP console, `new Worker('./workers/dagWorker.js')`, verify worker starts and responds to messages
- [X] T0003 [P] [US1] Implement Web Operation worker for API calls in `src/popup/workers/webOpWorker.ts`
  - **Details**: Worker that handles `web-operation` node type - fetch URLs, scrape content, handle HTTP requests
  - **Self-Test**: Post message `{ type: 'fetch', url: 'https://api.github.com' }`, verify response contains data
- [X] T0004 [P] [US1] Implement LLM Call worker for LLM API invocation in `src/popup/workers/llmCallWorker.ts`
  - **Details**: Worker that handles `llm-call` node type - invoke OpenAI/Anthropic/GLM APIs with proper headers
  - **Self-Test**: Post message `{ type: 'llm-call', prompt: 'Hello', config: {...} }`, verify LLM response
- [X] T0005 [P] [US1] Implement JS Execution worker for sandboxed code execution in `src/popup/workers/jsExecWorker.ts`
  - **Details**: Worker that handles `js-execution` node type - run JS code in isolated context with timeout
  - **Self-Test**: Post message `{ type: 'execute', code: 'return 1+1' }`, verify result is 2
- [X] T0006 [US1] Update execute_dag tool handler to spawn worker threads in `src/popup/services/toolRegistry.ts`
  - **Details**: Replace placeholder handler with real implementation that dispatches nodes to appropriate workers
  - **Self-Test**: Call `execute_dag` tool with nodes array, verify workers are spawned and execute
- [X] T0007 [US1] Connect workers to useDagEngine for concurrent execution in `src/popup/hooks/useDagEngine.ts`
  - **Details**: Update `executeNode` function to use worker threads instead of placeholder responses
  - **Self-Test**: Execute DAG with multiple independent nodes, verify they run concurrently in workers
- [X] T0008 [US1] Implement frontend React UI for DAG Engine to visualize node execution states (Pending, Running, Success, Error)
  - **Files**: `src/popup/Canvas/CanvasNode.tsx` (dag-node case), `src/popup/Canvas/DAGNode.tsx`
  - **Self-Test**: Trigger DAG execution via LLM, verify nodes appear on canvas with correct status indicators

**Checkpoint**: execute_dag spawns worker threads for web ops, LLM calls, and JS execution

---

## Phase 1: Setup (Manifest & Schema Updates)

**Purpose**: Update manifest.json with declarativeNetRequest permissions and create DAG schema definitions

**Priority Order**: Manifest updates FIRST per user request

- [X] T009 Add `declarativeNetRequest` and `declarativeNetRequestWithHostAccess` permissions to `public/manifest.json`
   - **Self-Test**: `chrome.management.getAll() in CDP console, verify permissions include declarativeNetRequest
- [X] T010 Create `public/rules.json` with header removal rules for X-Frame-Options and CSP frame-ancestors
   - **Self-Test**: Load extension, navigate to blocked site, check if iframe loads (may show error fallback)
- [X] T011 [P] Create DAG JSON schema definitions in `src/shared/dagSchema.ts`
   - **Self-Test**: In CDP console, `import('./src/shared/dagSchema.js')` and verify schema exports exist
- [X] T012 [P] Add `web-view` and `dag-node` types to `CanvasNodeType` in `src/shared/types.ts`
   - **Self-Test**: In CDP console, verify new types are available in global scope

**Checkpoint**: Manifest ready for iframe embedding support; DAG schema defined

---

## Phase 2: Foundational (Hover Context & Tool Registry)

**Purpose**: Create shared infrastructure used by all features

- [X] T013 Create `HoverStateContext` provider in `src/popup/context/HoverStateContext.tsx`
   - **Self-Test**: In CDP console, verify context is available: `React.useContext(HoverStateContext)`
- [X] T014 [P] Create `toolRegistry.ts` with tool definitions in `src/popup/services/toolRegistry.ts`
   - **Self-Test**: In CDP console, `import('./src/popup/services/toolRegistry.js')` and verify tools are registered
- [X] T015 [P] Update `CanvasNode` to support highlight prop based on HoverStateContext
   - **Self-Test**: Trigger hover via context, verify node receives highlight class
- [X] T016 Update `CanvasPanel` to pass `highlightedNodeId` to nodes
   - **Self-Test**: Set hoveredNodeId in context, verify corresponding canvas node has highlight styling

**Checkpoint**: Shared context and tool registry ready for all features

---

## Phase 3: User Story 1 - DAG Task Orchestration (Priority: P1) 🎯 MVP

**Goal**: LLM generates DAG plans that execute concurrently with visual progress tracking

**Independent Test**: Give complex task "Research React hooks and write code, summarize", verify DAG visualization appears, nodes execute

### Implementation for US1

- [X] T017 [US1] Create `useDagEngine` hook with state management in `src/popup/hooks/useDagEngine.ts`
   - **Self-Test**: In CDP console, call `useDagEngine()`, verify it returns `{ plan, execute, cancel }`
- [X] T018 [US1] Implement topological sort algorithm in `useDagEngine.ts`
   - **Self-Test**: Create circular dependency array, call sort, verify it throws error
- [X] T019 [US1] Implement concurrent execution with Promise.all in `useDagEngine.ts`
   - **Self-Test**: Execute DAG with independent nodes, verify they run concurrently
- [X] T020 [US1] Create `dagExecutor` service for node execution in `src/popup/services/dagExecutor.ts`
   - **Self-Test**: In CDP console, call `executeNode()` for each type, verify correct execution
- [X] T021 [US1] Create `DAGNode` canvas component with status indicators in `src/popup/Canvas/DAGNode.tsx`
   - **Self-Test**: Render DAGNode with different statuses, verify visual indicators update correctly
- [X] T022 [US1] Update `llmService` to support tool calling in `src/popup/services/llmService.ts`
   - **Self-Test**: Send message with tools defined, verify LLM receives tools array
- [X] T023 [US1] Add `execute_dag` tool handler in `toolRegistry.ts`
   - **Self-Test**: Call tool with valid DAG JSON, verify it creates DAGPlan and starts execution
- [X] T024 [US1] Update `App.tsx` to handle DAG tool responses
   - **Self-Test**: Send message that triggers DAG, verify plan is created and nodes appear on canvas
- [X] T025 [US1] Add DAG plan detection in chat message handler in `App.tsx`
   - **Self-Test**: Send "Research X, write code, summarize", verify DAG is generated instead of simple response

**Checkpoint**: DAG orchestration complete - complex tasks generate visual DAG plans with concurrent execution

---

## Phase 4: User Story 2 - Context Optimization (Priority: P1)

**Goal**: Chat sends only artifact metadata to LLM; LLM can fetch full content via tool call

**Independent Test**: Load file, ask about it, verify LLM calls read_artifact_content tool

### Implementation for US2

- [X] T026 [US2] Create `useArtifacts` hook in `src/popup/hooks/useArtifacts.ts`
   - **Self-Test**: In CDP console, call `useArtifacts()`, verify it returns `{ metadata, content, getMetadata }`
- [X] T027 [US2] Implement `getMetadata()` returning ArtifactMetadata[] in `useArtifacts.ts`
   - **Self-Test**: Create artifacts, call getMetadata(), verify only id/title/summary returned
- [X] T028 [US2] Implement `getContent(id)` returning full content in `useArtifacts.ts`
   - **Self-Test**: Call getContent(artifactId), verify full content is returned
- [X] T029 [US2] Add `read_artifact_content` tool definition in `toolRegistry.ts`
   - **Self-Test**: In CDP console, verify tool is registered with correct schema
- [X] T030 [US2] Update `llmService.sendMessage` to build context with metadata only
   - **Self-Test**: Send message with artifacts on canvas, verify context contains only summaries
- [X] T031 [US2] Implement tool response handler for `read_artifact_content` in `App.tsx`
   - **Self-Test**: Ask LLM about artifact, verify it calls tool and receives content
- [X] T032 [US2] Add auto-summary generation for loaded files in `App.tsx`
   - **Self-Test**: Load file, verify CanvasNode includes auto-generated summary in metadata

**Checkpoint**: Context optimization complete - LLM receives metadata only, fetches full content on demand

---

## Phase 5: User Story 3 - Artifact @-Mentions (Priority: P2)

**Goal**: Users can @ mention artifacts in chat; hovering highlights canvas nodes

**Independent Test**: Create artifacts, type @ in chat, verify dropdown appears, select artifact, hover over mention, verify canvas node highlights

### Implementation for US3

- [X] T033 [US3] Create `useMentions` hook in `src/popup/hooks/useMentions.ts`
   - **Self-Test**: In CDP console, call `useMentions()`, verify it returns `{ mentions, addMention, removeMention }`
- [X] T034 [US3] Create `MentionDropdown` component in `src/popup/Chat/MentionDropdown.tsx`
   - **Self-Test**: Render MentionDropdown with artifacts, verify list displays with titles
- [X] T035 [US3] Update `ChatInput` to detect @ character and show dropdown in `src/popup/Chat/ChatInput.tsx`
   - **Self-Test**: Type @ in input, verify dropdown appears within 100ms
- [X] T036 [US3] Implement mention insertion with span wrapper in `ChatInput.tsx`
   - **Self-Test**: Select artifact from dropdown, verify @mention is inserted in input
- [X] T037 [US3] Update `ChatMessage` to render @mentions as styled spans with hover handlers in `src/popup/Chat/ChatMessage.tsx`
   - **Self-Test**: Send message with @mention, verify it renders as styled link
- [X] T038 [US3] Connect hover events to `HoverStateContext` in `ChatMessage.tsx`
   - **Self-Test**: Hover over @mention, verify context.setHovered is called with artifact ID
- [X] T039 [US3] Update `App.tsx` to include @mentioned artifacts in LLM context
   - **Self-Test**: Send message with @mention, verify full artifact content is sent to LLM

**Checkpoint**: @-Mentions complete - users can reference artifacts with visual highlighting

---

## Phase 6: User Story 4 - Embedded Web Workspaces (Priority: P2)

**Goal**: Users and LLM can open URLs as embedded iframes in canvas

**Independent Test**: Send "Open https://example.com", verify iframe appears in canvas, can interact with page

### Implementation for US4

- [X] T032 [US4] Create `EmbeddedWebView` component in `src/popup/Canvas/EmbeddedWebView.tsx`
   - **Self-Test**: Render component with URL, verify iframe loads within 3 seconds
- [X] T033 [US4] Implement loading and error states in `EmbeddedWebView.tsx`
   - **Self-Test**: Load blocked URL, verify error state with fallback link
- [X] T034 [US4] Add `open_web_view` tool definition in `toolRegistry.ts`
   - **Self-Test**: In CDP console, verify tool is registered with correct schema
- [X] T035 [US4] Implement tool handler creating EmbeddedWebView node in `App.tsx`
   - **Self-Test**: Call open_web_view tool, verify canvas node is created
- [X] T036 [US4] Add URL pattern detection in chat handler in `App.tsx`
   - **Self-Test**: Send "Open https://react.dev", verify web view is created automatically
- [X] T037 [US4] Handle iframe load errors gracefully in `EmbeddedWebView.tsx`
   - **Self-Test**: Load non-embeddable URL, verify "Open in new tab" option appears

**Checkpoint**: Embedded Web Views complete - URLs can be opened as interactive iframes

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, UX improvements, integration testing

- [X] T045 Create `ToolTester` service for testing tools without LLM calls in `src/popup/services/toolTester.ts`
   - **Self-Test**: Run `node test-tool-tester.cjs`, verify all tools can be invoked and tested
- [X] T046 Add error boundaries around DAG execution to prevent full failure in `useDagEngine.ts`
   - **Self-Test**: Create DAG where one node fails, verify other nodes continue executing
- [X] T047 Add loading states and progress indicators for DAG execution in `DAGNode.tsx`
   - **Self-Test**: Execute DAG, verify progress shows in real-time as nodes complete
- [X] T048 Handle deleted artifacts in @mentions with strikethrough placeholder in `ChatMessage.tsx`
   - **Self-Test**: Mention artifact, delete it, verify mention shows "deleted artifact" style
- [X] T049 Add keyboard navigation for mention dropdown (Arrow keys, Enter, Escape) in `MentionDropdown.tsx`
   - **Self-Test**: Type @, press Arrow Down, verify selection changes, press Enter to select
- [X] T050 Add maximum concurrent DAG node limit (4) in `useDagEngine.ts`
   - **Self-Test**: Create DAG with 6 independent nodes, verify max 4 run at once
- [X] T051 Run full integration test via CDP: load file, @mention, execute DAG, open web view
   - **Self-Test**: Complete workflow executes without errors, all features work together
- [X] T052 Update AGENTS.md with new features and testing commands
   - **Self-Test**: Verify AGENTS.md includes Phase 2 feature documentation

**Checkpoint**: All features complete with error handling and polish

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories
- **US1 - DAG (Phase 3)**: Depends on Phase 2 - MVP feature
- **US2 - Context (Phase 4)**: Depends on Phase 2, uses DAG tools
- **US3 - Mentions (Phase 5)**: Depends on Phase 2
- **US4 - Web Views (Phase 6)**: Depends on Phase 1 (manifest), Phase 2
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

```
Phase 2 (Foundational)
        │
   ┌────┼────┐
   │         │         │
   ▼         ▼         ▼
US1(DAG)  US2(Context)  US3(Mentions)  US4(WebViews)
   │         │              │               │
   └─────────┴──────────────┘
                               │
                               ▼
                        Phase 7 (Polish)
```

### Parallel Opportunities

**Within Phase 1 (Setup)**: T003, T004 can run in parallel [P]
**Within Phase 2 (Foundational)**: T006, T007 can run in parallel [P]
**User Stories**: US1, US2, US3, US4 can be developed in parallel after Phase 2 (if team capacity allows)
**Within Phase 7**: T038, T041, T042 can run in parallel [P]

---

## Parallel Example: Phase 2 (Foundational)

```bash
# These tasks can run simultaneously:
Task T006: Create toolRegistry.ts with tool definitions
Task T007: Update CanvasNode to support highlight prop

# Then sequentially:
Task T005: Create HoverStateContext.tsx
Task T008: Update CanvasPanel to pass highlightedNodeId
```

---

## MVP Scope

**Recommended MVP**: Phase 1 + Phase 2 + Phase 3 (DAG Task Orchestration)

This delivers the core agentic capability - LLM can generate and execute complex multi-step plans with visual feedback.

**Alternative MVP**: Phase 1 + Phase 2 + Phase 4 (Context Optimization)

This delivers efficiency improvements for large files - LLM context stays small until content is needed.

---

## Implementation Strategy

1. **Week 1**: Phase 1 (Setup) + Phase 2 (Foundational) - Get infrastructure ready
2. **Week 2**: Phase 3 (DAG) - Deliver core agentic capability (MVP)
3. **Week 3**: Phase 4 (Context) + Phase 6 (Web Views) - Add efficiency and research capabilities
4. **Week 4**: Phase 5 (@-Mentions) + Phase 7 (Polish) - Complete UX and integration

---

## CDP Testing Commands Reference

All self-tests should use these CDP commands via `chrome-devtools-9222` MCP tools:

```javascript
// Navigate to extension popup
chrome-devtools_navigate_page --type url --url chrome-extension://[extension-id]/index.html

// Take snapshot to verify UI state
chrome-devtools_take_snapshot

// Execute JavaScript to verify internal state
chrome-devtools_evaluate_script --function "() => { return useDagEngine(); }"

// Check console for errors
chrome-devtools_list_console_messages --types '["error"]'
```
