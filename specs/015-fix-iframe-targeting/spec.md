# Feature Specification: Fix Iframe Targeting for Webview Sessions

**Feature Branch**: `015-fix-iframe-targeting`
**Created**: 2026-04-01
**Status**: Draft
**Input**: Bug fix — iframe postMessage communication between popup and embedded webviews fails due to session ID / canvas node ID mismatch, fragile URL-based iframe lookup, and missing nonce relay.

## Problem Statement

The webview iframe communication system has three targeting bugs that cause extraction failures, interaction timeouts, and browse session errors:

1. **Session ID vs Canvas Node ID mismatch**: `postToIframe(sessionId)` searches for `[data-node-id="${sessionId}"]`, but the iframe container's `data-node-id` is set to the canvas node ID (e.g., `dag-node-scrapeNode1`), not the webview session ID (e.g., `wv-1743500000-abc123`).

2. **Fragile URL-based iframe lookup**: `waitForExtraction` finds iframes via `iframe[src="${url}"]`, which fails when URLs redirect, get encoded differently, or when multiple iframes share similar URLs.

3. **Missing nonce in canvas node rendering**: When `EmbeddedWebView` is rendered from a canvas node, no `channelNonce` prop is passed. The `waitForExtraction` method sends the nonce directly via `postMessage` (bypassing the component), but the initial `EXTRACT_CONTENT` message must reach the bridge script before the iframe processes it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - DAG Scrape Node Extraction Works Reliably (Priority: P1)

A user runs an `execute_dag` with `scrape` nodes. The scrape node spawns a canvas web-view node and calls `browse_webview`. The extraction should reliably reach the correct iframe regardless of URL encoding, redirects, or timing.

**Why this priority**: This is the primary flow for web data extraction. Without reliable iframe targeting, all DAG scrape operations fail intermittently.

**Independent Test**: Can be tested by running `execute_dag` with a scrape node pointing at any URL and verifying extraction returns data without timeout.

**Acceptance Scenarios**:

1. **Given** a DAG scrape node for `https://example.com`, **When** the DAG executes, **Then** the webview bridge receives `EXTRACT_CONTENT`, extracts DOM, and returns `CONTENT_RESPONSE` without timeout
2. **Given** a DAG scrape node for a URL that redirects (e.g., `http://example.com` → `https://example.com`), **When** the DAG executes, **Then** extraction still succeeds by targeting iframe by session ID, not URL
3. **Given** two scrape nodes for different URLs in the same DAG, **When** both execute concurrently, **Then** each iframe receives only its own messages and responses don't cross

---

### User Story 2 - Webview Interactions Target Correct Iframe (Priority: P2)

A user's DAG includes `webview-interact` nodes after a `browse_webview`. The interaction (click, fill, select) must reach the correct iframe that was previously browsed, even when multiple webviews exist on the canvas.

**Why this priority**: Multi-step browsing workflows (browse → interact → extract) are useless if interactions go to the wrong iframe.

**Independent Test**: Create a DAG with a browse node followed by an interact node and verify the interaction targets the correct iframe.

**Acceptance Scenarios**:

1. **Given** a webview session `wv-abc123` with an iframe showing a form page, **When** `interact_webview` is called with `session_id=wv-abc123` and `action=fill`, **Then** the fill operation targets only that iframe, not any other
2. **Given** two concurrent webview sessions for different URLs, **When** `interact_webview` is called for session A, **Then** only session A's iframe receives the `INTERACT_ELEMENT` message

---

### User Story 3 - Navigate Back Targets Correct Iframe (Priority: P3)

A user navigates within a webview and then calls `navigate_webview_back`. The back navigation must reach the correct iframe.

**Why this priority**: Navigation history is a follow-up interaction; less critical than initial browse/interact.

**Independent Test**: Browse a URL, click a link to navigate, then call navigate_webview_back and verify it returns to the original page.

**Acceptance Scenarios**:

1. **Given** a webview session with navigation history, **When** `navigate_webview_back` is called, **Then** the `NAVIGATE_BACK` message reaches the correct iframe and the response includes the previous URL

---

### Edge Cases

- What happens when an iframe is removed from the canvas before extraction completes?
- What happens when the same URL is loaded in two different iframes (e.g., two scrape nodes for the same site)?
- What happens when a URL redirect changes the iframe's actual `src` attribute?
- What happens when `browse_webview` is called standalone (not via a DAG scrape node) and no canvas node exists?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `postToIframe` MUST locate iframes by session ID using a reliable mapping between session IDs and canvas node IDs
- **FR-002**: `waitForExtraction` MUST find the correct iframe without relying solely on URL string matching
- **FR-003**: When a webview session is created, the session ID MUST be stored on the iframe container element so `postToIframe` can find it
- **FR-004**: The `channelNonce` MUST be available to the `EmbeddedWebView` component so it can relay messages correctly
- **FR-005**: Multiple concurrent webview sessions MUST NOT cross-contaminate messages
- **FR-006**: URL redirects MUST NOT break iframe targeting
- **FR-007**: The fix MUST be backward-compatible with existing canvas nodes that don't have session IDs

### Key Entities

- **WebviewSession**: Existing entity — needs a `canvasNodeId` field to map sessions to their iframe containers
- **EmbeddedWebView**: Existing component — needs to accept and render `sessionId` as `data-session-id` on the container

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: DAG scrape nodes successfully extract content from iframes in >95% of attempts (currently failing intermittently due to targeting issues)
- **SC-002**: `interact_webview` with `session_id` reliably targets the correct iframe when multiple webviews exist
- **SC-003**: URL redirects (HTTP → HTTPS, path redirects) do not cause extraction timeouts
- **SC-004**: All existing DAG execution tests continue to pass after the fix
