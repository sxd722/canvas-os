---

description: "Task list for CanvasOS Agentic IDE implementation"
---

# Tasks: CanvasOS Agentic IDE

**Input**: Design documents from `/specs/001-canvasos-agentic-ide/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Chrome Extension**: `src/` for source, `public/` for static assets, `dist/` for build output
- Paths shown below follow the structure defined in plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directory structure per implementation plan
- [X] T002 Initialize package.json with dependencies (React 18+, Vite 5.x, Tailwind CSS 3.x, TypeScript 5.x)
- [X] T003 [P] Create vite.config.js for Chrome Extension build with local bundle output
- [X] T004 [P] Create tailwind.config.js with content paths for src/
- [X] T005 [P] Create tsconfig.json with strict mode and React JSX settings
- [X] T006 [P] Create public/manifest.json with MV3 configuration (permissions: storage, tabs, scripting)
- [X] T007 [P] Create src/styles/index.css with Tailwind directives
- [X] T008 Create index.html entry point at repository root
- [X] T009 [P] Create .gitignore for node_modules, dist, and IDE files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Create src/shared/types.ts with TypeScript interfaces (ChatMessage, CanvasNode, ResearchTask, SandboxExecution, LLMConfig, CanvasState, CanvasNodeType, ResearchStatus, ExecutionStatus)
- [X] T011 [P] Create src/shared/messages.ts with message type definitions (ExecuteMessage, ResultMessage, ErrorMessage, ResearchUrlMessage, ScrapeResultMessage, CreateCanvasNodeMessage)
- [X] T012 [P] Create src/shared/storage.ts with chrome.storage.local and chrome.storage.session helper functions (getChatMessages, getCanvasNodes, saveCanvasState, getLLMConfig)
- [X] T013 [P] Create src/popup/main.tsx entry point importing shared types
- [X] T014 [P] Create src/popup/App.tsx root component with 30/70 split layout
- [X] T015 [P] Create src/popup/Chat/ChatPanel.tsx container for chat messages with scrollable history
- [X] T016 [P] Create src/popup/Chat/ChatInput.tsx component for text input and submission
- [X] T017 [P] Create src/popup/Chat/ChatMessage.tsx component to display individual messages with timestamps
- [X] T018 [P] Create src/popup/Canvas/CanvasPanel.tsx container for infinite canvas with pan/zoom state
- [X] T019 [P] Create src/popup/Canvas/InfiniteCanvas.tsx component with transform-based panning
- [X] T020 [P] Create src/popup/Canvas/CanvasNode.tsx component for rendering different node types (text, file, summary, code-result)
- [X] T021 [P] Create src/popup/Canvas/CanvasPanel.tsx container for managing canvas state (nodes, offset, scale)
- [X] T022 [US1] Implement chat message submission to LLM API in src/popup/App.tsx
- [X] T023 [US1] Add chat input pattern detection ("Research [URL]") in src/popup/App.tsx
- [X] T024 [US1] Implement LLM service integration with configurable provider in src/popup/services/llmService.ts
- [X] T025 [US1] Implement chat state management with useState/useChat hook in src/popup/App.tsx

- [X] T026 [US1] Implement LLM response handling and parseResponse in src/popup/services/llmService.ts
- [X] T027 [US1] Add error handling for LLM API failures with user-friendly messages in chat panel

- [X] T028 [US1] Add LLM configuration persistence to chrome.storage.local

- [X] T029 [US1] Create LLMConfig component with provider selection and API key input in src/popup/components/LLmConfig/Config.tsx

- [X] T030 [US1] Implement file picker handler using window.showOpenFilePicker() in src/popup/Canvas/CanvasPanel.tsx
- [X] T031 [US2] Implement FileReader logic to read selected file contents as text
- [X] T032 [US2] Create canvas node with type 'file' containing filename and content preview
- [X] T033 [US2] Add error handling for unsupported browsers (showOpenFilePicker not available)
- [X] T034 [US2] Add error handling for file read failures with user-friendly messages in chat panel

**Checkpoint**: At this point, file load functionality is complete and can be demonstrated independently

---

## Phase 4: User Story 3 - Research URL Automation (Priority: P3)

**Goal**: Enable web research by typing "Research [URL]" in chat, scraping content invisibly, displaying summary on canvas

**Independent Test**: Type "Research [valid URL]" in chat, verify a summary card appears on canvas without visible browser tab activity

- [X] T035 [US3] Add "Research [URL]" pattern detection in chat input handler in src/popup/App.tsx
- [X] T036 [US3] Create src/content/scraper.ts content script for DOM extraction (document.body.innerText)
- [X] T037 [US3] Add RESEARCH_URL message handler in src/background/index.ts to create background tab
- [X] T038 [US3] Implement chrome.scripting.executeScript injection in background service worker
- [X] T039 [US3] Add SCRAPE_RESULT message handler in background to receive scraped content
- [X] T040 [US3] Implement automatic tab closing after content extraction in background service worker
- [X] T041 [US3] Add 30-second timeout for research operations with error handling in src/background/index.ts
- [X] T042 [US3] Create summary canvas node with type 'summary' from scraped content in src/background/index.ts
- [X] T043 [US3] Send create_canvas_node message from background to popup for summary display

**Checkpoint**: At this point, research URL automation is complete and can be tested independently

---

## Phase 5: User Story 4 - Safe Code Execution Sandbox (Priority: P4)

**Goal**: Execute LLM-generated JavaScript safely in a sandboxed iframe with postMessage communication

**Independent Test**: Trigger AI to generate executable code, verify code runs in sandbox and results return to main context without errors
- [X] T044 [US4] Complete src/sandbox/executor.ts with val() execution wrapped in try/catch
- [X] T045 [US4] Add 10-second execution timeout using setTimeout + race
- [X] T046 [US4] Add error handling for timeout exceeded state in executor.ts
- [X] T047 [US4] Add result handling for successful executions in executor.ts
- [X] T048 [US4] Clean up iframe reference after execution in src/popup/App.tsx

- [X] T049 [US4] Display execution results or errors from sandbox in chat or canvas
- [X] T050 [US4] Add error handling for postMessage validation (origin check, structure check) in src/popup/hooks/useSandboxExecutor.ts

- [X] T051 [US4] Implement sandbox execution UI in src/popup/components/Sandbox/SandboxExecutor.tsx with iframe ref and sandbox
- [X] T052 [US4] Display execution result in chat or canvas
- [X] T053 [US4] Add error handling for LLM API failures with user-friendly messages in chat panel

**Checkpoint**: At this point, sandbox execution is complete and can be tested independently

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T054 [P] Add documentation for user-facing features in README.md (create if missing)
- [X] T055 [P] Performance optimization across all stories (canvas virtualization)
- [X] T056 [P] Security hardening (input validation, message origin validation)
- [X] T057 [P] Run quickstart.md validation for development workflow

- [X] T058 [P] Additional error handling across all components

- [X] T059 Final commit after completing all phases

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational (Phase 2) - No dependencies on other stories
  - User stories can then proceed in parallel (if team capacity allows)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

- User stories can be worked on parallel by different team members

### Within Each User Story

- Chat components must to be complete before Canvas components can be added
- Tests (if included) must to be written and FAIL before implementation
- Models before services
- Services before endpoints/features
- Core implementation before integration
- Story complete before moving to next priority

- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Stop at any checkpoint to validate story independently
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: trailing whitespace

- Canvas supports at least 100 nodes without noticeable performance degradation (panning remains smooth)
- 95% of user interactions (chat, file load, research) complete without requiring a page reload or extension restart

- Each user story is independently completable and independently testable

- **User Story 4 (P4)** can be delivered as an standalone feature but necessary, but implement it first. The back, core features are stable, and then focus on the other advanced features.

- **User Story 1 (P1)** is the MVP. Comple this story to get a working agentic IDE.
    - Chat/Canvas split UI
    - File loading
    - Sandbox execution
    - Research URL automation

- **User Story 4 (P4)** enhances productivity but requires careful security implementation. It be delivered after core features are stable.
    - Each user story can be developed and tested in isolation
    - Incrementally delivered after core features are complete

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing (if tests were)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Stop at any checkpoint to validate story independently
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: trailing whitespace
