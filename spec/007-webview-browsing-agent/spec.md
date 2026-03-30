# Feature Specification: WebView Browsing Agent with Price Comparison

**Feature Branch**: `007-webview-browsing-agent`  
**Created**: 2026-03-30  
**Status**: Draft  
**Input**: User description: "The user asks the LLM to compare MacBook Pro prices in Canada and China. LLM opens webviews, LLM navigates to product pages, extracts prices, compares prices across regions, calculates taxes/currency conversion, builds comparison table. DAG visualization shows progress in real-time."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interactive WebView Browsing & Price Comparison (Priority: P1)

A user asks the LLM to compare MacBook Pro prices in Canada and China. The LLM opens two webviews (apple.ca and apple.com.cn), navigates to product pages, extracts prices, calculates taxes and currency conversion, and presents a comparison table. A DAG visualization on the canvas shows real-time progress of each step.

**Why this priority**: Core value proposition — this is the primary differentiator from existing webview functionality, enables autonomous multi-step web research.

**Independent Test**: Can be tested by asking "compare MacBook Pro prices in Canada and China" and verifying LLM opens webviews, navigates, extracts prices, and presents a comparison table.

**Acceptance Scenarios**:

1. **Given** user asks "Help me compare MacBook Pro prices in Canada and China", **When** LLM processes the request, **Then** LLM opens two webviews (one for apple.ca, one for apple.com.cn) and the system notifies LLM of webview status
2. **Given** LLM has two webviews open, **When** LLM sends navigation intent, **Then** system extracts page content locally (no token cost), identifies semantically relevant interactive elements, and returns them to LLM
3. **Given** LLM receives interactive elements from a page, **When** LLM clicks a relevant link, **Then** system navigates within webview, extracts new page content, and sends updated elements to LLM
4. **Given** LLM reaches the product price page, **When** LLM reads prices, **Then** system extracts prices and LLM proceeds to calculate taxes and currency conversion
5. **Given** LLM has extracted all prices, **When** LLM builds comparison table, **Then** DAG visualization on canvas shows all nodes completed and user sees final comparison table

---

### User Story 2 - Semantic Page Content Extraction (Priority: P2)

System extracts page content from webviews without consuming LLM tokens. Uses semantic similarity to identify relevant interactive elements matching LLM intent.

**Why this priority**: Enables the core browsing loop — without local extraction, the LLM would need to consume tokens reading full page content at each navigation step.

**Independent Test**: Can be tested by opening a webview, sending an intent, and verifying that extracted elements are semantically relevant to the intent.

**Acceptance Scenarios**:

1. **Given** webview is loaded with Apple Store homepage, **When** system receives intent "find MacBook Pro prices", **Then** system extracts page content and returns links/buttons related to "MacBook Pro" (not random navigation elements)
2. **Given** system extracted elements from a page, **When** LLM intent matches a "MacBook Pro" link, **Then** that link has a high relevance score (top 5 results) and is returned to LLM
3. **Given** webview loads a product listing page, **When** system extracts page content, **Then** returned elements include product links, prices if visible, and relevant navigation options

---

### User Story 3 - LLM WebView Navigation Loop (Priority: P3)

LLM navigates within webviews by interacting with elements. Loop continues until target information is found. System supports back navigation when LLM reaches wrong page.

**Why this priority**: Essential for robustness — without navigation and recovery, the browsing agent would get stuck on wrong pages.

**Independent Test**: Can be tested by navigating to a wrong page, requesting back navigation, and verifying LLM reaches correct page.

**Acceptance Scenarios**:

1. **Given** LLM clicks a link that navigates to wrong page, **When** page loads, **Then** system extracts new content and LLM decides to navigate back
2. **Given** LLM requests back navigation, **When** system navigates back in webview history, **Then** system returns previous page content with updated interactive elements
3. **Given** LLM navigates through multiple pages, **When** navigation history grows, **Then** system prevents infinite loops by limiting navigation attempts (max 10 per webview)

---

### User Story 4 - DAG Progress Visualization (Priority: P3)

Canvas shows a DAG representing the price comparison workflow with real-time progress updates as each step completes.

**Why this priority**: Visual feedback enhances user experience — users can track progress without reading chat logs.

**Independent Test**: Can be tested by starting a comparison task and verifying DAG nodes statuses update correctly on canvas.

**Acceptance Scenarios**:

1. **Given** user starts price comparison, **When** LLM opens webviews, **Then** canvas shows DAG with "Retrieve Canadian Price" and "Retrieve Chinese Price" nodes in pending state
2. **Given** LLM finds Canadian price, **When** price is extracted, **Then** corresponding DAG node transitions to completed with price data
3. **Given** both prices are found, **When** LLM calculates tax and converts currency, **Then** DAG shows "Calculate HST" and "Convert CAD to CNY" nodes completing in sequence
4. **Given** all data collected, **When** LLM builds comparison table, **Then** final DAG node completes and comparison table is presented

---

### Edge Cases

- What happens when a webview fails to load due to CORS/iframe restrictions?
- How does system handle webview pages that require authentication or CAPTCHA?
- What happens when prices are not displayed in a standard format on the page?
- What happens when the LLM gets stuck in a navigation loop (clicking same elements repeatedly)?
- How does system handle webviews where JavaScript-rendered content is not immediately available?
- What happens when exchange rate data is unavailable or the rate source fails?
- How does system handle pages with dynamic pricing (changing based on selections/configuration)?

- What happens if the user interrupts the comparison mid-process?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow LLM to open multiple webviews simultaneously for parallel browsing of different websites
- **FR-002**: System MUST extract page content from webviews locally without consuming LLM tokens for content extraction
- **FR-003**: System MUST identify interactive elements on webview pages (links, buttons, inputs, dropdowns) and return them to LLM in structured format
- **FR-004**: System MUST rank interactive elements by semantic relevance to LLM's stated intent using local similarity computation
- **FR-005**: System MUST allow LLM to interact with webview elements (click links, fill inputs, navigate) and receive updated page state after interaction
- **FR-006**: System MUST support back navigation within webviews when LLM reaches wrong page or needs to return to previous page
- **FR-007**: System MUST track navigation history per webview to prevent infinite navigation loops (max 10 interactions per webview)
- **FR-008**: System MUST provide page state summary after each navigation action, including current URL, page title, and relevant interactive elements
- **FR-009**: System MUST provide new tool definitions to LLM: `browse_webview` (open/navigate), `interact_webview` (click element), `extract_webview_content` (get page summary with interactive elements), and `navigate_webview_back` (go back)
- **FR-010**: System MUST show DAG visualization on canvas that represents the comparison workflow with nodes for each major step
- **FR-011**: System MUST update DAG node status in real-time as each step completes (pending -> running -> completed/failed)
- **FR-012**: System MUST handle webview loading errors gracefully by providing clear error messages and alternative options to LLM
- **FR-013**: System MUST support currency conversion for comparing prices across different currencies
- **FR-014**: System MUST support tax calculation for regions with applicable taxes (HST for Canada, VAT for China)
- **FR-015**: System MUST allow LLM to build a structured comparison table from collected data and present it to user
- **FR-016**: System MUST limit the agentic tool-call loop to prevent runaway webview interactions (max 15 iterations per comparison task)

### Key Entities

- **Webview Session**: An active browsing session within an embedded webview. Has unique ID, current URL, navigation history, last extracted content, and interactive elements. Lifecycle: from open until closed.
- **Interactive Element**: An element on a webview page that can be interacted with. Has element type (link/button/input/dropdown), text description, position/context, semantic relevance score, and unique identifier for interaction.
- **Page Content**: Extracted content from a webview page. Includes page title, URL, semantic summary (concise text), interactive elements list, and timestamp. Does NOT include raw HTML to minimize data size.
- **Navigation History**: Chronological list of URLs visited within a webview session. Supports back/forward navigation and prevents revisit loops.
- **Comparison DAG**: A directed acyclic graph representing the comparison workflow. Nodes represent steps (retrieve price, calculate tax, convert currency, build table). Edges represent data dependencies. Each node has status (pending/running/completed/failed) and result data.
- **Price Data**: Extracted pricing information. Includes product name, base price, currency, region, tax rate if applicable, and source URL.
- **Comparison Result**: Final comparison output. Includes structured table with base prices, tax amounts, shipping costs, currency-converted totals, and source attribution for each data point.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can complete a full price comparison task (open webviews, navigate, extract prices, get comparison table) in under 5 minutes from initial request
- **SC-002**: System accurately identifies relevant interactive elements matching LLM intent, with > 80% of top-5 returned elements being relevant to the stated goal
- **SC-003**: DAG visualization reflects all comparison steps in real-time with node transitions completing within 1 second of actual step completion
- **SC-004**: Token consumption for page content extraction is reduced by > 90% compared to sending full page HTML to LLM
- **SC-005**: LLM can navigate through webview pages without getting stuck in infinite loops (back navigation works correctly, max 10 interactions enforced)
- **SC-006**: System gracefully handles webview loading failures (CORS blocks, network errors) by providing clear fallback to LLM within 3 seconds
- **SC-007**: Final comparison table includes correct base prices, applicable taxes, and currency conversion with exchange rate data less than 5 minutes old
- **SC-008**: 90% of comparison attempts result in a meaningful comparison table without manual intervention from user

## Assumptions

- **Scope**: Initially supports Apple Store (apple.com.cn and apple.ca) for MacBook Pro price comparison. Other retailers and products are out of scope for initial implementation.
- **Currency Exchange**: Exchange rates fetched from a public API. Default source: Google Finance or equivalent free API. Rates are cached for 5 minutes.
- **Tax Calculation**: Canada HST at 13% (Ontario default), China VAT at 13%. Region-specific rates may vary; system uses standard rates unless user specifies otherwise.
- **Semantic Extraction**: Uses a lightweight embedding model running locally within the extension. No external API calls for content extraction. Default relevance threshold: 0.3 (cosine similarity). Top 10 results returned per extraction.
- **Webview Constraints**: Apple Store websites are assumed to be embeddable in iframes. If blocked, system provides fallback link to open in new tab.
- **DAG Creation**: DAG structure is automatically inferred from comparison request. DAG nodes map to major workflow steps (price retrieval -> tax calculation -> currency conversion -> table building).
- **Navigation Limits**: Maximum 10 interactions per webview to prevent runaway loops. Maximum 15 total tool calls per comparison task.
- **Price Format**: System expects prices in standard numeric format on pages. If prices are dynamically loaded or in non-standard format, extraction accuracy may be reduced.
- **Product Scope**: MacBook Pro line (all current models). Does not include MacBook Air, iMac, or other Apple products in initial implementation. User can request specific models.
