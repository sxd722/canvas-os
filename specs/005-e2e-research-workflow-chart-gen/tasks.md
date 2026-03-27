# Tasks: E2E Research Workflow with Chart Generation

**Input**: Design documents from `/specs/005-e2e-research-workflow-chart-gen/`
**Prerequisites**: plan.md,**Tests**: Not explicitly requested - tests omitted per spec

**Organization**: Tasks grouped by execution phase for independent testing and- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Chrome Extension project: `src/popup/`, `src/background/`, `src/shared/`
- Paths based on plan.md structure

---

## Phase 1: Setup

**Purpose**: Project initialization and type definitions

- [ ] T001 Add ContentExtractionResult interface to src/shared/types.ts
- [ ] T002 [P] Add CONTENT_EXTRACTION message types to src/shared/messages.ts
- [ ] T003 [P] Install @mozilla/readability dependency in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before **CRITICAL**: No user story work can begin until phase 2 is- [ ] T004 Add content extraction utility functions to src/popup/services/contentExtractor.ts
- [ ] T005 [P] Add handleContentFetch message handler to src/background/index.ts
- [ ] T006 [P] Register read_webpage_content tool definition in src/popup/services/toolRegistry.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Retrieve Product Information (US1)

**Goal**: Enable LLM to load a webpage, extract content, and report specific information (pricing, availability) back to user

**Test**: User asks "What is the price of MacBook Pro on apple.com?", system loads page
 extracts content, LLM reports price

**Dependencies**: Phase 2 complete

### Tasks

- [ ] T007 [US1] Implement open_web_view tool call in `src/popup/services/toolRegistry.ts`
- [ ] T008 [US1] Implement read_webpage_content tool call in `src/popup/services/toolRegistry.ts`
- [ ] T009 [US1] Add CONTENT_FETCH message handling in `src/background/index.ts`
- [ ] T010 [US1] Add error handling for blocked pages and timeouts in tool calls
- [ ] T011 [US1] Add unit test for content extraction flow
- [ ] T012 [US1] Add E2E test case for ToolTester for- [ ] T013 [US1] Add E2E test to CDP script

**Checkpoint**: User Story 1 complete - end-to-end research and product prices and works
---

## Phase 4: User Story 2 - Summarize Webpage Content (US2)

**Goal**: Enable LLM to visit a webpage, generate a concise summary

**Test**: User says "Summarize the article at https://example.com/tech-news", system loads page
 extracts content
 LLM generates summary

**Dependencies**: Phase 2 complete, - User Story 1 recommended (provides core extraction utilities)

### Tasks

- [ ] T014 [US2] Add execute_dag support with readability mode
    - [ ] T015 [US2] Add test case for multi-page summarization with data extraction
    - [ ] T016 [US2] Add E2E test case for ToolTester
    - [ ] T017 [US2] Add E2E test to CDP script

**Checkpoint**: User Story 2 complete - summarization works end-to-end
---

## Phase 5: User Story 3 - Extract Specific Data Points (US3)

**Goal**: Enable LLM to extract specific data points from webpages

**Test**: User asks "Extract all email addresses from this contact page", system loads page
 LLM returns email list

**Dependencies**: Phase 2 complete, - User Story 1 recommended (provides web view functionality)

### Tasks

- [ ] T018 [US3] Add extractPrices function
    - [ ] T019 [US3] Add extractEmails function
    - [ ] T020 [US3] Add extractDates function
    - [ ] T021 [US3] Add execute_dag support with data-points extraction mode
    - [ ] T022 [US3] Add test case for data point extraction
    - [ ] T023 [US3] Add E2E test case
 ToolTester
    - [ ] T024 [US3] Add E2E test to CDP script

**Checkpoint**: User Story 3 complete - data point extraction works
---

## Phase 6: Polish &- [ ] T025 [P] Update AGENTS.md with E2E workflow documentation
    - [ ] T026 Run npm run build
    - [ ] T027 Run npm run lint
    - [ ] T028 Manual E2E test via CDP
