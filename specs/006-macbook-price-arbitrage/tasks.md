# Tasks: MacBook Price Arbitrage DAG

**Input**: Design documents from `/specs/006-macbook-price-arbitrage/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not explicitly requested in spec — test tasks omitted. CDP-based verification used instead.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Chrome Extension project: `src/` at repository root
- Shared types: `src/shared/`
- Background service worker: `src/background/`
- Popup UI/services: `src/popup/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify build pipeline is clean before making changes

- [x] T001 Verify clean build with `npm run build` passes with zero errors from current `006-macbook-price-arbitrage` branch
- [x] T002 Verify `npm run lint` passes with no new warnings

---

## Phase 2: Foundational — LLMProvider Abstraction & DAG Schema Extension

**Purpose**: Create the LLMProvider interface, DevAgentProvider, extend DAG schema with scrape/llm_calc types, and hardcode the DAG generation system prompt. These are blocking prerequisites for all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### LLMProvider Interface & Implementations

- [x] T003 Create `LLMProvider` interface, `Message`, `CompletionOptions`, and `CompletionResult` types in `src/shared/llm-provider.ts` — follow the contract in `specs/006-macbook-price-arbitrage/contracts/llm-provider.md`
- [x] T004 Implement `DevAgentProvider` class in `src/shared/llm-provider.ts` — POST to `http://localhost:8000/v1/chat/completions` with OpenAI-compatible format, parse `choices[0].message.content`, return `CompletionResult` (never throw)
- [x] T005 [P] Implement `ProdAPIProvider` class in `src/shared/llm-provider.ts` — wrap existing 3-provider logic from `src/popup/workers/llmCallWorker.ts` (openai/anthropic/glm/custom), provider-specific auth headers and response parsing
- [x] T006 Implement `createLLMProvider(config: LLMConfig): LLMProvider` factory function in `src/shared/llm-provider.ts` — select `DevAgentProvider` when `config.endpoint` starts with `http://localhost` or `http://127.0.0.1`, otherwise `ProdAPIProvider`

### DAG Schema Extension

- [x] T007 Extend `DAGNodeType` union with `'scrape' | 'llm_calc'` in `src/shared/dagSchema.ts`
- [x] T008 [P] Add `ScrapeParams` interface (`{ type: 'scrape'; url: string; selector?: string; waitMs?: number; timeout?: number }`) in `src/shared/dagSchema.ts`
- [x] T009 [P] Add `LLMCalcParams` interface (`{ type: 'llm_calc'; prompt: string; model?: string }`) in `src/shared/dagSchema.ts`
- [x] T010 Update `DAGNodeParams` union type to include `ScrapeParams | LLMCalcParams` in `src/shared/dagSchema.ts`
- [x] T011 [P] Update `DAG_JSON_SCHEMA` enum to include `'scrape' | 'llm_calc'` in `src/shared/dagSchema.ts`

### DAG Generation System Prompt

- [x] T012 Create hardcoded DAG generation system prompt constant `DAG_GENERATION_PROMPT` in a new file `src/shared/dag-prompts.ts` — this prompt instructs the dev LLM to output the correct parallel 5-node schema: 4 independent `scrape` nodes (Apple CA, Apple CN, exchange rate, HST rate) with `dependsOn: []`, followed by 1 `llm_calc` node with `dependsOn: [all 4 scrape node IDs]`. Include the JSON schema structure, node type descriptions, and a worked example of the MacBook Pro CA vs CN comparison DAG

### Worker Refactor

- [x] T013 Refactor `src/popup/workers/llmCallWorker.ts` to use `LLMProvider` via `createLLMProvider(config)` instead of hardcoded provider logic — replace the `if (config.provider === 'anthropic')` / `else` branches with `provider.complete(messages, options)`, keep `self.onmessage` handler unchanged

### Update Tool Definitions

- [x] T014 Update `execute_dag` tool definition `items.properties.type.enum` in `src/popup/services/toolRegistry.ts` to include `'scrape' | 'llm_calc'` with descriptions

**Checkpoint**: Foundation ready — LLMProvider abstraction, new DAG types, and system prompt in place. Build must pass.

---

## Phase 3: User Story 1 — Parallel Price Data Collection (Priority: P1) 🎯 MVP

**Goal**: Execute 4 concurrent scrape nodes that each open a real Chrome tab, extract DOM content, and return structured data

**Independent Test**: Trigger a DAG with 4 `scrape` nodes (dependsOn: []), verify all 4 execute concurrently via canvas status updates, and confirm each returns extracted page content

### Background Service Worker — SCRAPE_TAB Handler

- [x] T015 Add `SCRAPE_TAB` message handler in `src/background/index.ts` — follow the `handleResearchUrl()` pattern: `chrome.tabs.create({ url, active: false })` → wait `waitMs` (default 3000) for JS rendering → `chrome.scripting.executeScript({ target: { tabId }, func: extractContent, args: [selector] })` → `chrome.tabs.remove(tabId)` → return `{ success, content, title, extractedAt, durationMs }`. Cap content at 50,000 chars. Always clean up tab on error. Support optional `selector` param (default: `document.body.innerText`) and `timeout` param (default: 30000ms) using `Promise.race` pattern from existing `handleResearchUrl`.

### Popup — toolRegistry scrape Handler

- [x] T016 Add `scrape` node type branch in `src/popup/services/toolRegistry.ts` `executeNodeWithWorker()` — send `{ type: 'SCRAPE_TAB', url, selector, waitMs, timeout }` via `chrome.runtime.sendMessage`, resolve with response on success, reject with error on failure. Store result in `nodeResults` map per existing pattern.

**Checkpoint**: At this point, 4 scrape nodes should execute concurrently and return DOM content. Verify via CDP on port 9222.

---

## Phase 4: User Story 2 — Automated Price Calculation via Aggregation (Priority: P1)

**Goal**: Implement the `llm_calc` node type that aggregates results from all 4 scrape nodes, formats them into a single LLM prompt, and produces a price comparison result

**Independent Test**: Create a 5-node DAG (4 scrape + 1 llm_calc), verify the llm_calc node waits for all 4 predecessors, concatenates their results, calls LLMProvider, and outputs a comparison

### Aggregation Logic in toolRegistry

- [x] T017 Implement `formatAggregatedPrompt(interpolatedPrompt: string, dependencies: string[], depResults: Record<string, unknown>): string` helper in `src/popup/services/toolRegistry.ts` — formats each dependency's result as `[Data from {nodeId}]: {JSON.stringify(result)}` followed by the task prompt. This concatenates all parallel scrape results into a single context window for the LLM call.

- [x] T018 Add `llm_calc` node type branch in `src/popup/services/toolRegistry.ts` `executeNodeWithWorker()` — validate `dependsOn` is not empty (throw if empty), check all dependency nodes have `status: 'success'` (throw if any failed/skipped), interpolate `$nodeId` placeholders in prompt using existing `interpolateCodeWithDeps()` pattern, call `formatAggregatedPrompt()` to build the full context, create LLMProvider via `createLLMProvider(currentLLMConfig!)`, call `provider.complete([{ role: 'user', content: aggregatedPrompt }], { model: params.model })`, return `{ success: true, response: result.content, model: result.model, tokens: result.tokens, aggregatedFrom: node.dependencies }`

- [x] T019 Add dependency-failure skip logic in `src/popup/services/toolRegistry.ts` — in `executeDAGWithWorkers()`, before executing each node, check if any dependency has `status: 'error'` or `'skipped'`. If so, set node status to `'skipped'` with error message listing which dependency failed. This ensures llm_calc is skipped (not executed) when any scrape node fails.

**Checkpoint**: Full 5-node MacBook Price Arbitrage DAG should work end-to-end: 4 concurrent scrapes → aggregated LLM call → comparison result. Verify via CDP.

---

## Phase 5: User Story 3 — DAG Visualization on Canvas (Priority: P2)

**Goal**: Display scrape and llm_calc nodes with correct type labels on the canvas

**Independent Test**: Execute the price arbitrage DAG and verify canvas shows 4 "Scrape" nodes and 1 "LLM Calc" node with correct status colors

- [x] T020 [P] Add `scrape: 'Scrape'` and `llm_calc: 'LLM Calc'` entries to `typeLabels` object in `src/popup/Canvas/DAGNode.tsx`

**Checkpoint**: Canvas correctly renders new node types with labels and status colors.

---

## Phase 6: User Story 4 — Flexible Product and Market Queries (Priority: P3)

**Goal**: Enable the LLM to generate correct DAG plans for different products and market pairs beyond the hero demo

**Independent Test**: Ask for "Compare MacBook Air prices US vs Japan" and verify the DAG adapts URLs and data sources while maintaining the same parallel topology

- [x] T021 Update `DAG_GENERATION_PROMPT` in `src/shared/dag-prompts.ts` to include generalized instructions for different products (MacBook Air, iPhone, etc.) and market pairs (US vs Japan, UK vs Germany, etc.) — keep the same parallel topology (4 scrape + 1 llm_calc) but make the URL patterns and data source descriptions parameterizable

**Checkpoint**: LLM generates correct DAG plans for different product/market combinations.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, build verification, and edge case hardening

- [x] T022 Add error propagation for partial DAG failures in `src/popup/services/toolRegistry.ts` — when a scrape node fails, include the specific source URL and error message in the llm_calc skip reason so the user sees which data source failed
- [x] T023 Add content-length guard in `src/background/index.ts` SCRAPE_TAB handler — cap extracted content at 50,000 characters to prevent memory issues with large pages
- [x] T024 Verify full build with `npm run build` — zero errors, zero CSP violations
- [x] T025 Run quickstart.md validation — launch Chrome with `--remote-debugging-port=9222`, load extension from `dist/`, test the full MacBook Pro CA vs CN comparison flow end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify existing build
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (T007-T014 for scrape type, T013 for worker refactor)
- **US2 (Phase 4)**: Depends on Phase 2 + US1 (needs scrape handler working to test aggregation)
- **US3 (Phase 5)**: Depends on Phase 2 (needs scrape/llm_calc types defined) — can run parallel to US1/US2
- **US4 (Phase 6)**: Depends on Phase 2 (needs system prompt file) — can run parallel to US1/US2
- **Polish (Phase 7)**: Depends on US1 + US2 completion

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependency on other stories
- **US2 (P1)**: After Phase 2 + US1 (aggregation needs scrape results to test)
- **US3 (P2)**: After Phase 2 — independent of US1/US2 (UI-only change)
- **US4 (P3)**: After Phase 2 — independent (prompt-only change)

### Parallel Opportunities

```
Phase 2 parallel groups:
  Group A: T004 (DevAgentProvider) ‖ T005 (ProdAPIProvider)
  Group B: T008 (ScrapeParams) ‖ T009 (LLMCalcParams) ‖ T011 (JSON schema)
  T003 → T004, T005 → T006 (sequential within LLMProvider)
  T007 → T008, T009, T010, T011 (schema extensions)

Phase 3 can run parallel to Phase 5 and Phase 6.
Phase 4 must wait for Phase 3.
```

---

## Parallel Example: Phase 2 Foundational

```
# After T001-T002 (build verification):

# Group A — LLMProvider (sequential chain):
T003 → T004 → T006  (interface → DevAgent → factory)
T003 → T005 → T006  (interface → ProdAPI → factory, T004‖T005 parallel)

# Group B — Schema extensions (all parallel, after T007):
T008 ‖ T009 ‖ T010 ‖ T011

# Group C — Independent tasks (parallel to everything above):
T012 (system prompt) ‖ T013 (worker refactor) ‖ T014 (tool definitions)
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (build verification)
2. Complete Phase 2: Foundational (LLMProvider, schema, system prompt)
3. Complete Phase 3: US1 (scrape nodes)
4. Complete Phase 4: US2 (aggregation + llm_calc)
5. **STOP and VALIDATE**: Full 5-node MacBook Pro CA vs CN comparison works end-to-end
6. Demo the hero feature

### Incremental Delivery

1. Setup + Foundational → Abstraction layer ready
2. Add US1 → 4 concurrent scrapes work → Demo (partial)
3. Add US2 → Full DAG with aggregation → Demo (hero feature complete!)
4. Add US3 → Canvas labels polished → Demo
5. Add US4 → Flexible queries → Demo
6. Polish → Production-ready

---

## Key Implementation Files

| File | Status | Tasks |
|------|--------|-------|
| `src/shared/llm-provider.ts` | NEW | T003, T004, T005, T006 |
| `src/shared/dag-prompts.ts` | NEW | T012, T021 |
| `src/shared/dagSchema.ts` | MODIFY | T007, T008, T009, T010, T011 |
| `src/popup/services/toolRegistry.ts` | MODIFY | T014, T016, T017, T018, T019, T022 |
| `src/popup/workers/llmCallWorker.ts` | MODIFY | T013 |
| `src/background/index.ts` | MODIFY | T015, T023 |
| `src/popup/Canvas/DAGNode.tsx` | MODIFY | T020 |
