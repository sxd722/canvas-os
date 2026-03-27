# Tasks: Webview Content Retrieval for LLM Task Completion

**Input**: Design documents from `/specs/004-webview-content-retrieval/`
**Prerequisites**: plan.md, spec.md, research.md

**Tests**: Not explicitly requested - tests omitted per spec

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Chrome Extension project: `src/popup/`, `src/background/`, `src/shared/`
- Paths based on plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [ ] T001 Add ContentExtractionResult interface to src/shared/types.ts
- [ ] T002 [P] Add CONTENT_EXTRACTION message types to src/shared/messages.ts
- [ ] T003 [P] Install @mozilla/readability dependency in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add content extraction utility functions to src/popup/services/contentExtractor.ts
- [ ] T005 [P] Add handleContentFetch message handler to src/background/index.ts
- [ ] T006 [P] Register read_webpage_content tool definition in src/popup/services/toolRegistry.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Retrieve Product Information (Priority: P1)

**Goal**: Enable LLM to load a webpage, extract content, and report specific information (pricing, availability) back to user

**Independent Test**: User asks "What is the price of MacBook Pro on apple.com?", system loads page, extracts content, LLM reports price

### Implementation for User Story 1

- [ ] T007 [US1] Implement extractTextContent function in src/popup/services/contentExtractor.ts
- [ ] T008 [US1] Implement truncateContent function (max 50KB) in src/popup/services/contentExtractor.ts
- [ ] T009 [US1] Implement extractMetadata function in src/popup/services/contentExtractor.ts
- [ ] T010 [US1] Implement read_webpage_content handler in src/popup/services/toolRegistry.ts
- [ ] T011 [US1] Add CONTENT_FETCH message handling in src/background/index.ts
- [ ] T012 [US1] Implement content notification to LLM via tool_result in src/popup/services/toolRegistry.ts
- [ ] T013 [US1] Add error handling for blocked pages (X-Frame-Options) in src/popup/services/toolRegistry.ts
- [ ] T014 [US1] Add timeout handling (30s default) in src/popup/services/toolRegistry.ts

**Checkpoint**: User Story 1 complete - LLM can retrieve and report product information from webpages

---

## Phase 4: User Story 2 - Summarize Webpage Content (Priority: P2)

**Goal**: Enable LLM to visit a webpage and generate a concise summary of its content

**Independent Test**: User says "Summarize the article at https://example.com/tech-news", system loads page, extracts content, LLM generates summary

### Implementation for User Story 2

- [ ] T015 [US2] Implement readability-based content extraction using @mozilla/readability in src/popup/services/contentExtractor.ts
- [ ] T016 [US2] Add extractMainContent function for article extraction in src/popup/services/contentExtractor.ts
- [ ] T017 [US2] Update read_webpage_content tool to support extraction mode parameter in src/popup/services/toolRegistry.ts
- [ ] T018 [US2] Add word count and reading time to metadata in src/popup/services/contentExtractor.ts

**Checkpoint**: User Story 2 complete - LLM can summarize webpage content

---

## Phase 5: User Story 3 - Extract Specific Data Points (Priority: P3)

**Goal**: Enable LLM to extract specific data points (prices, dates, contact info) from webpages

**Independent Test**: User asks "Extract all email addresses from this contact page", system loads page, LLM returns email list

### Implementation for User Story 3

- [ ] T019 [US3] Add structured data extraction helpers in src/popup/services/contentExtractor.ts
- [ ] T020 [US3] Implement extractPrices helper function in src/popup/services/contentExtractor.ts
- [ ] T021 [US3] Implement extractEmails helper function in src/popup/services/contentExtractor.ts
- [ ] T022 [US3] Implement extractDates helper function in src/popup/services/contentExtractor.ts
- [ ] T023 [US3] Update read_webpage_content to support dataPoint extraction mode in src/popup/services/toolRegistry.ts

**Checkpoint**: User Story 3 complete - LLM can extract specific data points

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T024 [P] Update AGENTS.md with new tool documentation
- [ ] T025 [P] Add content extraction error codes to src/shared/types.ts
- [ ] T026 Run npm run build to verify no build errors
- [ ] T027 Run npm run lint to verify code quality
- [ ] T028 Manual test via CDP: invoke read_webpage_content tool and verify content extraction

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 extraction capabilities
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends US1 extraction capabilities

### Within Each User Story

- Content extractor functions before toolRegistry handler
- ToolRegistry handler before background integration
- Core implementation before error handling

### Parallel Opportunities

- T001, T002, T003 can run in parallel (different files)
- T004, T005, T006 can run in parallel (different files)
- T024, T025 can run in parallel (different files)

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all setup tasks together:
Task: "Add ContentExtractionResult interface to src/shared/types.ts"
Task: "Add CONTENT_EXTRACTION message types to src/shared/messages.ts"
Task: "Install @mozilla/readability dependency in package.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test content extraction via CDP
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All code must follow MV3 CSP compliance (no eval, no remote CDNs)
