# Feature Specification: MacBook Price Arbitrage DAG

**Feature Branch**: `006-macbook-price-arbitrage`
**Created**: 2026-03-27
**Status**: Draft
**Input**: User description: "Add a new E2E Hero Feature: The 'MacBook Price Arbitrage' DAG. When the user asks to compare MacBook Pro prices between Canada and China, the LLM must generate a highly parallel DAG plan (Scrape Apple CA, Scrape Apple CN, Scrape CAD/CNY rate, Scrape HST rate concurrently, followed by a final calculation node)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Parallel Price Data Collection (Priority: P1)

As a user shopping for a MacBook Pro, I want the system to simultaneously collect pricing data from Apple Canada, Apple China, current CAD/CNY exchange rate, and applicable Canadian sales tax (HST), so that I get a comprehensive cross-border price comparison in one step.

**Why this priority**: This is the core value proposition — collecting all necessary data concurrently so the user doesn't have to manually visit multiple sites. Without this, the feature has no purpose.

**Independent Test**: Can be fully tested by asking the system to compare MacBook Pro prices between Canada and China, verifying that 4 concurrent data-fetching nodes execute in parallel on the canvas, and confirming each node returns structured pricing/rate data.

**Acceptance Scenarios**:

1. **Given** the user types a request to compare MacBook Pro prices between Canada and China, **When** the LLM generates a DAG plan, **Then** the plan contains 4 independent data-collection nodes (Apple CA prices, Apple CN prices, CAD/CNY exchange rate, HST rate) with no inter-dependencies among them
2. **Given** the 4 independent nodes are ready, **When** DAG execution starts, **Then** all 4 nodes execute concurrently (within the system's parallelism limit) rather than sequentially
3. **Given** a data-collection node completes, **When** its result is captured, **Then** the result includes structured data (product name, raw price, currency, tax rate, or exchange rate as applicable)

---

### User Story 2 - Automated Price Calculation and Comparison (Priority: P1)

As a user, I want the system to automatically calculate the final all-in cost in each currency after taxes and currency conversion, so that I can see which market offers the better deal without doing any math myself.

**Why this priority**: Without the calculation step, raw scraped data is not actionable — users need the final comparison to make a purchasing decision. This completes the core workflow.

**Independent Test**: Can be tested by verifying that after all 4 data-collection nodes complete, a final calculation node executes that receives all 4 results, applies HST to Canadian prices, converts to a common currency, and outputs a clear comparison table.

**Acceptance Scenarios**:

1. **Given** all 4 data-collection nodes have completed successfully, **When** the final calculation node executes, **Then** it receives all 4 predecessor results via dependency interpolation
2. **Given** the calculation node has all data, **When** it computes the final prices, **Then** it applies Canadian HST to the Canadian price, converts both prices to a common currency using the scraped exchange rate, and outputs a side-by-side comparison
3. **Given** the calculation completes, **When** the result is displayed, **Then** the user sees a clear comparison showing product name, price in CAD (with HST), price in CNY, and which market is cheaper (and by how much)

---

### User Story 3 - DAG Visualization on Canvas (Priority: P2)

As a user, I want to see the entire price arbitrage workflow visualized as a DAG on the canvas with real-time progress updates, so that I can understand which data is being collected and watch the analysis come together.

**Why this priority**: Visual feedback enhances user confidence and understanding of the multi-step process, but the core functionality (data collection + calculation) works without it.

**Independent Test**: Can be tested by executing the price arbitrage DAG and verifying that nodes appear on the canvas, update their status in real-time (pending → running → success/error), and show the final result.

**Acceptance Scenarios**:

1. **Given** the DAG plan is generated, **When** it is displayed on the canvas, **Then** the visual layout shows 4 parallel nodes connected to a single downstream calculation node
2. **Given** DAG execution is in progress, **When** nodes change status, **Then** the canvas updates in real-time to reflect running, completed, or failed states
3. **Given** a node fails during execution, **When** the error is displayed, **Then** the user can see which specific data source failed and the calculation node is skipped or shows a partial result with a clear error message

---

### User Story 4 - Flexible Product and Market Queries (Priority: P3)

As a user, I want to compare prices for different MacBook models or different market pairs (not just Canada vs China), so that the feature is useful for various cross-border shopping scenarios.

**Why this priority**: Extends the feature beyond the hero demo use case, making it a reusable pattern for price arbitrage. Lower priority because the hero scenario (MacBook Pro, CA vs CN) is the primary demo.

**Independent Test**: Can be tested by asking for comparisons with different products (e.g., MacBook Air, iPhone) or different country pairs (e.g., US vs Japan) and verifying the DAG adapts its data sources accordingly.

**Acceptance Scenarios**:

1. **Given** the user asks about a different MacBook model, **When** the LLM generates the DAG, **Then** it adjusts the scraping targets to match the requested product while maintaining the same parallel structure
2. **Given** the user asks about different countries, **When** the LLM generates the DAG, **Then** it adjusts the data-collection nodes (different Apple store URLs, different exchange rates, different tax rates) while keeping the same DAG topology

---

### Edge Cases

- What happens when Apple Canada or Apple China blocks the scraping request (anti-bot, geo-restriction)? The affected node fails gracefully, and the calculation node reports partial results with a clear warning about the missing data source.
- What happens when the exchange rate source returns stale or unavailable data? The node reports the error, and the calculation proceeds with available data or informs the user that exchange rate data could not be fetched.
- What happens when the scraped page content doesn't contain structured price data (page layout changed)? The LLM extraction node should detect the missing data and report a structured error rather than producing a meaningless result.
- What happens when the user asks about a product that doesn't exist on one of the Apple stores? The node reports "product not found" for that market, and the comparison shows only the available market's data.
- What happens when all 4 data-collection nodes fail? The calculation node is skipped, and the user receives a clear error summary explaining that no data could be collected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a user requests a MacBook Pro price comparison between Canada and China, the LLM MUST generate a DAG plan with exactly 4 independent data-collection nodes and 1 dependent calculation node
- **FR-002**: The 4 data-collection nodes MUST execute concurrently (not sequentially) to minimize total workflow time
- **FR-003**: Data-collection node 1 MUST fetch MacBook Pro pricing data from Apple Canada's online store
- **FR-004**: Data-collection node 2 MUST fetch MacBook Pro pricing data from Apple China's online store
- **FR-005**: Data-collection node 3 MUST fetch the current CAD/CNY exchange rate from a reliable financial data source
- **FR-006**: Data-collection node 4 MUST fetch the applicable Canadian HST rate (or inform the user of the standard rate if province-specific rates are requested)
- **FR-007**: The calculation node MUST depend on all 4 data-collection nodes (it cannot execute until all predecessors complete)
- **FR-008**: The calculation node MUST apply Canadian HST to the Canadian store price to produce the final all-in CAD price
- **FR-009**: The calculation node MUST convert both final prices to a common currency using the scraped exchange rate for accurate comparison
- **FR-010**: The final result MUST present a clear side-by-side comparison showing: product name, price in local currency (with tax applied), price in the comparison currency, and which market is cheaper (with the difference amount)
- **FR-011**: If any data-collection node fails, the system MUST NOT silently proceed — it MUST report which source failed and either show partial results with a warning or skip the calculation with an error explanation
- **FR-012**: The entire workflow (from user query to final result) MUST complete within 60 seconds under normal network conditions
- **FR-013**: The LLM MUST be able to recognize natural language variations of the price comparison request (e.g., "Which is cheaper, MacBook Pro in Canada or China?", "Compare MacBook Pro prices CA vs CN")

### Key Entities

- **Price Arbitrage DAG Plan**: A directed acyclic graph with 5 nodes — 4 independent data-collection nodes (Apple CA, Apple CN, exchange rate, tax rate) and 1 dependent calculation node that consumes all 4 results
- **Scraped Price Data**: Product name, raw price amount, currency code (CAD or CNY), product configuration (if applicable), and timestamp of data collection
- **Exchange Rate Data**: Currency pair (CAD/CNY), rate value, source, and timestamp
- **Tax Rate Data**: Tax type (HST/GST/PST), rate percentage, applicable province (default: national average), and source
- **Price Comparison Result**: Product name, final price in each market (with taxes), prices converted to a common currency, price difference, and recommended market

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users receive a complete price comparison result (with all 4 data sources) within 60 seconds of submitting their query
- **SC-002**: The 4 data-collection nodes execute concurrently, reducing total data-gathering time by at least 50% compared to sequential execution
- **SC-003**: The final comparison output includes all-in prices (after tax) in both currencies, making the result immediately actionable for a purchasing decision
- **SC-004**: When any data source fails, users receive a clear explanation of which source failed rather than a generic error or incorrect result
- **SC-005**: The DAG visualization on canvas accurately represents the parallel structure (4 independent nodes feeding into 1 calculation node) and updates in real-time during execution

## Assumptions

- Apple Canada and Apple China online stores are accessible and return parseable product pages with pricing information
- A reliable exchange rate data source is available via web scraping (e.g., financial data websites or APIs)
- The existing `web-operation` DAG node type is sufficient for fetching web content, and the existing `js-execution` or `llm-call` node type can handle the final calculation
- The LLM can accurately identify the correct Apple store URLs and exchange rate sources for the requested markets
- Canadian HST rate varies by province — the system will use a reasonable default (e.g., Ontario 13%) or the national average unless the user specifies a province
- Users have a stable internet connection for all web fetching operations
