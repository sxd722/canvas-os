# Feature Specification: Interactive Webview Browsing Agent

**Feature Branch**: `007-webview-browsing-agent`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "The user asks the LLM 'Help me compare the price of mac book pro in Canada and China', LLM initiates two functions calls to open two webviews for apple.com.cn and apple.ca, the canvasOS opens the webview and notify the LLM. LLM then replies with intentions (probably looking for mbp prices), and canvasOS extract page contents locally without consuming any tokens (one possible way is to use an embedding model to encode the web page into vectors semantically and uses cosine distance to pick the closed things to the model's intention), after extraction, canvasOS sends the LLM with semantically related interactable elements on the web page. LLM then decides to interact with one of the elements (this loop might go back and forth a bit, as LLM may navigate to the wrong page and needs to go back). Finally, the LLM is at the mbp price pages. Upon receiving canvasOS's page brief, LLM decides to read the prices, look for HST and CAD->CNY ratio (this might involves more webview operations) and forming a table. During this process, in the canvas side, show a DAG that is ([apple.ca webview]->retrieve mbp Canadian price, [apple.com.cn webview]->retrieve mbp Chinese price)->calculate CAD HST->convert CAD to CNY->Build a table, and mark each node done if the LLM completes the search."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interactive Webview Browsing with Semantic Extraction (Priority: P1)

A user asks the LLM a question that requires browsing multiple websites (e.g., "Help me compare the price of MacBook Pro in Canada and China"). The LLM opens webviews for relevant sites, canvasOS extracts page content locally using semantic matching (no token cost), sends interactive elements back to the LLM, and the LLM navigates through the pages by interacting with elements until it finds the desired information. The canvas displays a real-time DAG showing the multi-step browsing workflow.

**Why this priority**: This is the core value proposition — the LLM can autonomously browse the web through webviews with local semantic extraction, avoiding token costs for raw page content. Without this, the feature doesn't exist.

**Independent Test**: Can be tested by asking the LLM to "compare MacBook Pro prices between Canada and China" and verifying: (1) two webview nodes appear on canvas, (2) semantic extraction returns relevant elements, (3) LLM navigates to correct pages, (4) DAG shows on canvas with correct dependency chain.

**Acceptance Scenarios**:

1. **Given** the chat is open with no active webviews, **When** user types "Compare MacBook Pro prices in Canada and China", **Then** the LLM calls `open_web_view` twice (apple.ca and apple.com.cn), two webview nodes appear on the canvas, and the LLM receives a notification with initial page state
2. **Given** two webviews are loaded on the canvas, **When** canvasOS performs semantic extraction, **Then** the LLM receives a list of interactable elements semantically relevant to the stated intent (e.g., "MacBook Pro" links, navigation items), without sending raw page HTML through the LLM API
3. **Given** the LLM receives interactive elements, **When** the LLM decides to click a navigation element, **Then** the webview navigates to the new page, canvasOS extracts content from the new page, and the updated elements are sent back to the LLM
4. **Given** the LLM is on a wrong page, **When** the LLM decides to navigate back, **Then** the webview returns to the previous page and re-extracts content
5. **Given** the LLM reaches the target MacBook Pro price pages for both regions, **When** the LLM reads the prices, **Then** it can extract specific price values and proceed to build a comparison

---

### User Story 2 - DAG Visualization of Browsing Workflow (Priority: P2)

During the interactive browsing process, the canvas displays a DAG that represents the multi-step browsing and extraction workflow. Each node represents a discrete operation (open webview, extract content, interact with element, compute comparison, build table), and nodes are marked as done when the LLM completes each step.

**Why this priority**: Provides visual feedback and progress tracking. Valuable but the browsing agent works without it — the DAG is an enhancement to the UX, not the core mechanism.

**Independent Test**: Can be tested by triggering any multi-step browsing task and verifying the DAG appears on canvas with correct node dependencies, statuses update in real-time, and the final node shows the completed result.

**Acceptance Scenarios**:

1. **Given** the LLM initiates a multi-step browsing task, **When** the DAG is generated, **Then** the canvas shows a DAG with nodes: [apple.ca webview] -> retrieve Canadian price, [apple.com.cn webview] -> retrieve Chinese price -> calculate HST -> convert CAD to CNY -> build comparison table
2. **Given** the DAG is displayed, **When** each browsing step completes, **Then** the corresponding DAG node transitions from "pending" to "running" to "success" with the result shown
3. **Given** a DAG node fails (e.g., webview blocked), **When** the failure occurs, **Then** the node shows "error" status and dependent nodes are marked "skipped"

---

### User Story 3 - Semantic Content Extraction without Token Cost (Priority: P3)

When a webview page loads, canvasOS extracts page content locally using a semantic matching approach (embedding model or similar), identifies the most relevant sections and interactive elements based on the LLM's stated intent, and sends only the relevant summary to the LLM — avoiding the cost of sending entire page HTML through the API.

**Why this priority**: Cost optimization is important but secondary to the core browsing interaction. A simpler extraction approach (e.g., DOM parsing with heuristics) could serve as an initial implementation.

**Independent Test**: Can be tested by loading a webview, checking that the extracted content sent to the LLM is significantly smaller than the raw page HTML, and that it contains the most relevant elements for the stated intent.

**Acceptance Scenarios**:

1. **Given** a webview loads apple.ca, **When** canvasOS extracts content with intent "find MacBook Pro prices", **Then** the extraction returns links/buttons/sections related to "MacBook Pro" and "pricing" — not the entire page DOM
2. **Given** the extraction result, **When** sent to the LLM, **Then** the payload is less than 2000 tokens (vs potentially 50k+ for full page), and contains enough context for the LLM to decide its next action
3. **Given** the webview navigates to a new page, **When** re-extraction occurs, **Then** the extraction adapts to the new page content and returns updated relevant elements

---

### Edge Cases

- What happens when a webview site blocks iframe embedding (X-Frame-Options / CSP)? → Fallback to "Open in new tab" with manual guidance from LLM, DAG node shows "blocked" status
- What happens when the embedding model fails to load or times out? → Fallback to simple DOM heuristic extraction (title, headings, links, buttons) without semantic scoring
- What happens when the LLM enters a navigation loop (clicking back and forth)? → Limit navigation iterations (e.g., max 10 interactions per webview) and notify the LLM
- What happens when a webview page has no relevant content for the stated intent? → Return empty element list with page summary so LLM can decide to navigate elsewhere
- What happens when two webviews need to interact with each other's results (e.g., cross-referencing prices)? → DAG handles this through dependency nodes — the comparison node depends on both extraction nodes
- What happens when the user sends a new message while browsing is in progress? → Allow interruption; cancel current browsing and start fresh, or queue the new request

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow the LLM to open multiple webviews via `open_web_view` tool and receive notification of each webview's load status
- **FR-002**: System MUST extract page content from loaded webviews locally (within the extension) without sending raw HTML through the LLM API
- **FR-003**: System MUST perform semantic matching to identify page elements most relevant to the LLM's stated browsing intent
- **FR-004**: System MUST return a structured list of interactable elements (links, buttons, inputs) to the LLM with descriptions and element identifiers
- **FR-005**: System MUST allow the LLM to interact with elements in a webview (click links, fill inputs) via tool calls and receive updated page state
- **FR-006**: System MUST support back navigation within a webview to allow the LLM to recover from wrong navigation decisions
- **FR-007**: System MUST display a DAG on the canvas representing the multi-step browsing workflow with real-time status updates
- **FR-008**: System MUST support concurrent webview browsing (multiple webviews being navigated simultaneously)
- **FR-009**: System MUST limit browsing iterations per webview session to prevent infinite loops (configurable, default 10)
- **FR-010**: System MUST handle blocked webviews gracefully (sites that refuse iframe embedding) with fallback to tab opening
- **FR-011**: System MUST inject content scripts into webview iframes for DOM access using `all_frames: true` pattern or `chrome.scripting.executeScript` with frameId targeting
- **FR-012**: System MUST communicate between webview iframe content scripts and the extension popup via postMessage bridging

### Key Entities

- **WebviewSession**: Represents an active webview browsing session. Tracks URL, navigation history, current page state, and associated canvas node. Has a unique session ID linked to the canvas web-view node.
- **InteractiveElement**: A clickable/interactable element on a webview page. Has element selector, description, element type (link/button/input/select), relevance score, and text content. Identified by content script DOM analysis.
- **PageExtraction**: The result of extracting content from a webview page. Contains interactive elements list, page summary (title, headings, key text), extraction method used (semantic or heuristic), and relevance metadata.
- **BrowsingIntent**: The LLM's stated goal for a webview browsing session. Used to guide semantic extraction and element scoring. Updated as the LLM refines its search.
- **BrowseDAG**: A specialized DAG representing a multi-webview browsing workflow. Contains webview-browse, webview-interact, webview-extract, and computation nodes with dependencies.
- **NavigationHistory**: Stack of URLs visited within a webview session, enabling back navigation and cycle detection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: LLM can successfully navigate to a target product page on apple.com/apple.com.cn through interactive element selection within 5 navigation steps
- **SC-002**: Semantic extraction reduces page content sent to LLM by at least 80% compared to full page HTML (measured in tokens)
- **SC-003**: DAG visualization updates in real-time with less than 500ms latency between a browsing action completing and the corresponding node status change
- **SC-004**: Two concurrent webview sessions can operate independently without interfering with each other's navigation or extraction
- **SC-005**: Back navigation returns to the previous page and re-extracts content within 3 seconds
- **SC-006**: Full comparison workflow (open 2 webviews → navigate to product pages → extract prices → build comparison table) completes within 60 seconds for well-structured sites
