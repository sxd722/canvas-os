# Feature Specification: Fix Iframe Targeting ID Mismatch

**Feature Branch**: `017-fix-iframe-id-mismatch`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User description: "Fix the iframe targeting ID mismatch — the canvas node ID and the session ID used to locate iframes are mismatched, so postToIframe cannot find the correct iframe container."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - DAG Scrape Nodes Successfully Extract Content (Priority: P1)

A user runs a DAG plan that includes a scrape node targeting a web page. The scrape node spawns a webview canvas node and instructs it to load and extract content. Currently, extraction fails or times out because the message-sending system cannot locate the correct iframe — it searches using an identifier that does not match the canvas node's DOM attribute. After this fix, the extraction message reaches the correct iframe every time.

**Why this priority**: This is the primary failure mode. The core scrape-and-extract workflow is broken without it. All other stories depend on messages reliably reaching iframes.

**Independent Test**: Execute a DAG with a scrape node via CDP or the chat interface and verify extraction results are returned (not a timeout).

**Acceptance Scenarios**:

1. **Given** a DAG scrape node targets a URL, **When** the scrape node executes, **Then** the webview iframe receives the extraction message and returns page content successfully
2. **Given** a scrape node runs, **When** the canvas node is created, **Then** the node ID used to create the canvas node is the same ID used to locate the iframe container in the DOM
3. **Given** multiple webview nodes exist on the canvas simultaneously, **When** a scrape node sends an extraction request, **Then** the message is delivered only to the correct iframe

---

### User Story 2 - Browse Webview Tool Targets Correct Iframe (Priority: P2)

A user triggers the browse_webview tool directly (not via a scrape node), which creates a webview canvas node and loads a page. The same ID mismatch affects this path — the canvas node ID must be propagated to the iframe targeting system so the extraction message reaches the right iframe.

**Why this priority**: This is the second creation path for webview nodes. It shares the same root cause but follows a different code path through the UI layer rather than the DAG engine.

**Independent Test**: Send a message like "Open https://example.com" in the chat and verify the webview loads and extracts content.

**Acceptance Scenarios**:

1. **Given** the browse_webview tool is invoked directly from the chat, **When** a webview node appears on the canvas, **Then** the canvas node ID is passed into the tool execution so the iframe can be targeted
2. **Given** browse_webview is called, **When** the extraction message is sent to the iframe, **Then** the message reaches the iframe corresponding to the correct canvas node

---

### User Story 3 - Scrape Node Passes Canvas Node ID Through (Priority: P3)

When a scrape node spawns a canvas webview node and then calls browse_webview, the canvas node ID must flow from the scrape handler into the browse_webview call so that the entire chain — from node creation to iframe targeting — uses a consistent identifier. Currently the scrape handler creates a node with one ID but does not pass it to browse_webview, breaking the chain.

**Why this priority**: This is the plumbing that connects US1 and US2 — the canvas node ID generated in the scrape handler must be injected into the browse_webview arguments.

**Independent Test**: Run a scrape node and verify that the canvas_node_id argument appears in the browse_webview call (observable via console logs).

**Acceptance Scenarios**:

1. **Given** a scrape node executes and creates a canvas node with ID `X`, **When** the scrape handler calls browse_webview, **Then** the call includes the canvas node ID `X` in its arguments
2. **Given** browse_webview receives a canvas node ID, **When** it sends messages to the iframe, **Then** it uses that canvas node ID to locate the correct iframe container

---

### Edge Cases

- What happens when browse_webview is called without a canvas_node_id (e.g., from an older client or a direct test)? The system should fall back to searching by session ID, maintaining backward compatibility.
- What happens when the canvas node is deleted before extraction completes? The extraction should fail gracefully with a clear "container not found" error rather than hanging.
- What happens when multiple scrape nodes run concurrently? Each must pass its own canvas_node_id and target only its own iframe — no cross-contamination.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The canvas node ID used to create a webview node MUST be the same identifier used by the iframe targeting system to locate that node's iframe in the DOM
- **FR-002**: When browse_webview is invoked from the chat UI, the canvas node ID MUST be assigned before the tool executes and passed as a parameter to the tool
- **FR-003**: When browse_webview is invoked from the scrape handler, the existing canvas node ID MUST be injected into the tool arguments before execution
- **FR-004**: The iframe targeting function MUST accept an optional canvas node ID and use it as the primary lookup, falling back to the session ID when no canvas node ID is provided
- **FR-005**: The extraction wait function MUST pass the canvas node ID through to the iframe targeting function for reliable fallback delivery
- **FR-006**: The system MUST remain backward-compatible — webview nodes created without a canvas_node_id must still function using session ID as a fallback

### Key Entities

- **Canvas Node ID**: The unique identifier assigned to a webview canvas node at creation time. Stored as a DOM attribute on the iframe container element.
- **Session ID**: The unique identifier for a browsing session, created by the webview session manager. Different from the canvas node ID but usable as a fallback for locating iframes.
- **Iframe Container**: The DOM element wrapping a webview iframe. Has a `data-node-id` attribute matching the canvas node ID. The iframe targeting system must find this container to deliver messages.

## Assumptions

- The `data-node-id` attribute on iframe containers is the canonical way to locate a specific webview's iframe in the DOM.
- Canvas node IDs are globally unique and do not collide across creation paths (scrape, direct browse, URL pattern).
- The canvas node is always created before the iframe targeting system needs to find it (with a small render delay already accounted for).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: DAG scrape nodes return extraction results successfully in at least 95% of attempts (up from current frequent timeout failures)
- **SC-002**: The correct iframe is located on the first lookup attempt in over 90% of cases, without requiring retry loops
- **SC-003**: Multiple concurrent webview nodes can be targeted independently without message cross-contamination
- **SC-004**: Existing webview nodes created without canvas_node_id continue to function via session ID fallback — zero backward-compatibility regressions
