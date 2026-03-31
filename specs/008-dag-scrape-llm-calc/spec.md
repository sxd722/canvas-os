# Feature Specification: DAG Scrape and LLM Calc Node Support

**Feature Branch**: `008-dag-scrape-llm-calc`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "Fix the DAG execution engine to support 'scrape' and 'llm_calc' nodes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scrape Web Pages Within a DAG (Priority: P1)

A user asks the system to compare prices from multiple e-commerce websites. The LLM generates a DAG with independent `scrape` nodes for each URL. Each scrape node opens a real browser tab, waits for the page to fully render (JavaScript execution), extracts the visible text (optionally targeting a specific CSS selector), and returns the content for downstream aggregation.

**Why this priority**: Scraping is the foundational capability — without it, `llm_calc` nodes have no data to aggregate. Price comparison, research synthesis, and multi-source data extraction all depend on scrape nodes working first.

**Independent Test**: Can be fully tested by submitting a prompt like "Compare prices from these two URLs" and verifying that each URL's page content is captured and returned as a DAG node result, viewable on the canvas.

**Acceptance Scenarios**:

1. **Given** the DAG engine is executing a plan containing a `scrape` node, **When** the node's turn arrives, **Then** the system opens a background browser tab to the specified URL, waits for the page to render, extracts the page text, closes the tab, and returns the content as the node result.
2. **Given** a `scrape` node with a CSS selector parameter, **When** the node executes, **Then** only the text within the matched element is returned instead of the full page.
3. **Given** a `scrape` node targeting a URL that fails to load (network error, DNS failure), **When** the node executes, **Then** the node is marked as failed with an error message and dependent nodes are skipped.
4. **Given** a `scrape` node with a configurable timeout, **When** the page takes longer than the timeout to respond, **Then** the scrape is aborted, the tab is cleaned up, and the node is marked as failed.

---

### User Story 2 - Aggregate Scraped Data with LLM (Priority: P2)

A user asks the system to extract structured data from multiple scraped pages (e.g., "Find the cheapest MacBook price from these 3 stores"). After scrape nodes complete, an `llm_calc` node receives all predecessor results, interpolates them into a prompt template (replacing `$nodeId` placeholders with the actual scraped content), sends the assembled prompt to the configured LLM, and returns the LLM's structured analysis.

**Why this priority**: Aggregation is the value multiplier — raw scraped content is useful but structured analysis is what users actually need for decision-making.

**Independent Test**: Can be tested by submitting a prompt that requires comparing data from two URLs and verifying the LLM returns a structured comparison result on the canvas.

**Acceptance Scenarios**:

1. **Given** a DAG where an `llm_calc` node depends on one or more completed scrape nodes, **When** all dependencies are satisfied, **Then** the system interpolates each dependency's result into the `llm_calc` prompt (replacing `$depNodeId` placeholders) and sends the assembled prompt to the LLM.
2. **Given** an `llm_calc` node with a `model` parameter, **When** the node executes, **Then** the specified model is used instead of the default configured model.
3. **Given** no LLM configuration has been set by the user, **When** an `llm_calc` node attempts to execute, **Then** the node fails with a clear error indicating that LLM configuration is required.
4. **Given** the LLM returns an error (rate limit, invalid API key), **When** the `llm_calc` node executes, **Then** the node is marked as failed with the error message from the LLM provider.

---

### Edge Cases

- What happens when a scrape node's content exceeds the LLM context window when passed to a downstream `llm_calc` node?
- How does the system handle a scrape node targeting a site that blocks automated access (anti-bot measures)?
- What happens when multiple scrape nodes run concurrently (up to 4) and some succeed while others fail — does the `llm_calc` node receive partial data?
- What happens when a scrape node returns empty content (page loaded but no visible text)?
- What happens when the `llm_calc` prompt template has a `$nodeId` reference that doesn't match any dependency?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The DAG execution engine MUST route `scrape` type nodes to the background script via message passing, passing the URL, optional CSS selector, optional wait time, and optional timeout.
- **FR-002**: The DAG execution engine MUST route `llm_calc` type nodes to the LLM provider, passing the interpolated prompt (with dependency results substituted) and optional model override.
- **FR-003**: The `scrape` node handler MUST return the extracted page content, page title, extraction timestamp, and duration when successful.
- **FR-004**: The `scrape` node handler MUST reject with an error message when the background script reports failure (network error, timeout, invalid URL).
- **FR-005**: The `llm_calc` node handler MUST substitute all `$dependencyNodeId` placeholders in the prompt with the JSON-serialized result of each dependency before sending to the LLM.
- **FR-006**: The `llm_calc` node handler MUST reject with a clear error when no LLM configuration is available.
- **FR-007**: The `llm_calc` node handler MUST return the LLM's response content when successful, and reject with the LLM's error message when the LLM call fails.
- **FR-008**: The console.log tracing system MUST include entry/exit logging for both `scrape` and `llm_calc` node execution, consistent with existing node type logging patterns.
- **FR-009**: Scraped content returned by the background script MUST be capped at 50,000 characters to prevent excessive memory usage in the DAG results map.

### Key Entities

- **Scrape Node**: A DAG node that opens a background browser tab to a URL, waits for rendering, and extracts visible text. Parameters: `url` (required), `selector` (optional CSS selector), `waitMs` (optional render wait, default 3000ms), `timeout` (optional overall timeout, default 30000ms).
- **LLM Calc Node**: A DAG node that sends an assembled prompt (with dependency results interpolated) to the configured LLM for structured analysis. Parameters: `prompt` (required, may contain `$depNodeId` placeholders), `model` (optional model override).
- **Dependency Interpolation**: The mechanism by which `$nodeId` placeholders in prompts/code are replaced with JSON-serialized results from completed predecessor nodes. Already exists for `js-execution` nodes via `interpolateCodeWithDeps`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A DAG containing `scrape` nodes completes execution and displays scraped content on the canvas for every successfully scraped URL.
- **SC-002**: A DAG containing `llm_calc` nodes returns a structured LLM analysis result that incorporates data from predecessor scrape nodes.
- **SC-003**: Failed `scrape` or `llm_calc` nodes display their error message on the canvas and do not block independent sibling nodes from executing.
- **SC-004**: The full execution trace (node start, success, failure) is visible in Chrome DevTools console with the `[DAG]` prefix, matching the existing logging pattern.
- **SC-005**: Build and type-check pass with zero errors after implementation.

## Assumptions

- The background script `SCRAPE_TAB` message handler and its response shape are already implemented and working (confirmed in `src/background/index.ts`).
- The `createLLMProvider` factory function and `LLMProvider.complete()` interface already exist in `src/shared/llm-provider.ts`.
- The `ScrapeParams` and `LLMCalcParams` types are already defined in `src/shared/dagSchema.ts`.
- The `interpolateCodeWithDeps` method already exists in `toolRegistry.ts` and works for string interpolation with dependency results.
- Content capping at 50,000 characters is already handled by the background script's `SCRAPE_CONTENT_CAP` constant.
