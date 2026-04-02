# Tasks: Universal Semantic Lookup Tool

**Feature**: 013-semantic-lookup-tool
**Branch**: `013-semantic-lookup-tool`
**Date**: 2026-04-01
**Input**: Feature specification from `/specs/013-semantic-lookup-tool/spec.md`
**Status**: Ready for Implementation
---

## Summary

Transform the webview browsing agent into a universal semantic information lookup tool by removing hardcoded price-extraction logic. The system will pair text content with structural context to rank by cosine similarity, and return a hybrid payload with information chunks and interactive elements.

**Implementation scope**: 2 files modified (~100 lines changed)
- `src/content/webview_bridge.js` - Semantic chunk extraction
- `src/popup/services/semanticExtractor.ts` - Scoring logic

**Independent delivery**: Each user story can be implemented, tested, and deployed independently.
**MVP scope**: User Story 1 only (semantic chunk extraction)
**Estimated effort**: 2-4 hours

---

## Task Breakdown

| Phase | User Story | Task Count | Parallel | Purpose |
|-------|-----------|-------------|----------|---------|
| 1 | Setup | 2 | Yes | Project structure verification |
| 2 | Foundational | 2 | No | Remove hardcoded patterns, add helper functions |
| 3 | US1 - Extract Semantic Chunks | 4 | Yes | DOM traversal and context pairing |
| 4 | US2 - Score by Semantic Relevance | 3 | Yes | Cosine similarity ranking |
| 5 | US3 - Return Hybrid Payload | 3 | Yes | Payload structure changes |
| 6 | Polish | 3 | Yes | Documentation, build, lint |

| **Total** | **18 tasks** |

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → **Phase 3 (US1)** → **Phase 4 (US2)** → **Phase 5 (US3)** → **Phase 6 (Polish)**
- All phases sequential
- Within phases, US1 and US2 can run in parallel (different files)

- **User stories can be deployed independently in any order**
- **Foundational (Phase 2)** must be completed before US stories
- **All user stories should be tested before deployment**
- **MVP = User Story 1 only** (semantic chunk extraction)
- **All user stories can be tested independently**

---

## Phase 1: Setup

- [ ] T001 Verify git repo is initialized
- [ ] T002 Verify .gitignore has necessary patterns

---

## Phase 2: Foundational

- [ ] T003 Remove CURRENCY_PATTERN constant and price-specific logic from src/content/webview_bridge.js
- [ ] T004 Add findStructuralContext helper function in src/content/webview_bridge.js

---

## Phase 3: US1 - Extract Semantic Chunks with Context (Priority: P1)

**Goal**: Extract semantic chunks by pairing text content with their closest structural context (headings, table headers, aria-labels).

**Independent Test**: Can be fully tested by loading a page with structured content (headings, paragraphs, tables) and verifying that extracted chunks include both text content and structural context.

- [ ] T005 [US1] Add extractSemanticChunks function in src/content/webview_bridge.js
- [ ] T006 [US1] Add context pairing logic (h1-h6, th, aria-labels) in src/content/webview_bridge.js
- [ ] T007 [US1] Add deduplication logic for semantic chunks in src/content/webview_bridge.js
- [ ] T008 [US1] Filter hidden elements (width/height <= 0) in src/content/webview_bridge.js

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: US2 - Score Chunks by Semantic Relevance (Priority: P1)

**Goal**: Rank all extracted semantic chunks by their semantic similarity to the user's intent.

**Independent Test**: Can be fully tested by providing various intents and verifying that returned chunks are semantically relevant.

- [ ] T009 [US2] Update scoreElements function to handle SemanticChunk type in src/popup/services/semanticExtractor.ts
- [ ] T010 [US2] Remove price-specific boost logic from src/popup/services/semanticExtractor.ts
- [ ] T011 [US2] Ensure cosine similarity scoring works for semanticExtractor.ts

**Checkpoint**: At this point, User Story 2 should be fully functional and testable independently.

---

## Phase 5: US3 - Return Hybrid Navigation Payload (Priority: P2)

**Goal**: Return a hybrid payload containing both static information chunks and interactive elements, each independently ranked by semantic relevance.

**Independent Test**: Can be fully tested by browsing a page and verifying the returned payload contains both `information_chunks` and `interactive_elements` arrays.

- [ ] T012 [US3] Update CONTENT_RESPONSE message structure in src/content/webview_bridge.js
- [ ] T013 [US3] Add information_chunks and interactive_elements arrays to payload in src/content/webview_bridge.js
- [ ] T014 [US3] Ensure both arrays are independently ranked in src/content/webview_bridge.js

**Checkpoint**: At this point, User Story 3 should be fully functional and testable independently.

---

## Phase 6: Polish

- [ ] T015 [P] Update AGENTS.md with feature notes
- [ ] T016 [P] Run build verification (npm run build)
- [ ] T017 [P] Run lint verification (npm run lint)

---

## Parallel Execution Examples

### Setup Phase (Parallel)
```bash
# T001 and T002 can run in parallel
git rev-parse --git-dir 2>/dev/null
echo "Is git repo"
```

### Foundational Phase (Sequential)
```bash
# T003: Remove hardcoded patterns
# T004: Add helper function
```

### US1 Phase (Parallel within file)
```bash
# T005, T006, T007, T008 can run in parallel
# All modify webview_bridge.js
```

### US2 Phase (Parallel with US1)
```bash
# T009, T010, T011 can run in parallel
# All modify semanticExtractor.ts
```

### US3 Phase (Parallel with US1 and US2)
```bash
# T012, T013, T014 can run in parallel
# All modify webview_bridge.js
```

### Polish Phase (Parallel)
```bash
# T015, T016, T017 can run in parallel
# Documentation, build, lint
```

---

## Implementation Strategy
### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: US1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery
1. Complete Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Deploy/Demo (MVP!)
3. Add US2 → Test independently → Deploy/Demo
4. Add US3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes
- **Semantic chunk extraction**: Pairs text content (p, span, td) with closest structural context (h1-h6, th, aria-labels)
- **No hardcoded patterns**: All currency symbol checks and price-specific boost logic removed
- **Cosine similarity**: Pure semantic ranking using Transformers.js embeddings
- **Hybrid payload**: Two arrays (information_chunks, interactive_elements) each with top 5 items
- **Hidden element filter**: Width/height > 0 check remains
