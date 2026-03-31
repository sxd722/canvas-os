# Feature Specification: Fix DAG Config Initialization and Scrape-to-Webview Routing

**Feature Branch**: `009-fix-dag-config-scrape`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "Fix the DAG execution errors by initializing the tool registry config and routing scrape nodes to canvas webviews"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - LLM Config Available for DAG Nodes (Priority: P1)

A user configures their LLM API key in the extension settings. After configuration, they submit a prompt that generates a DAG plan with `llm_calc` nodes. Previously, these nodes would fail with "LLM configuration is required" because the tool registry's internal config was never initialized. After this fix, the tool registry receives the LLM configuration on startup and whenever settings change, so `llm_calc` nodes execute successfully and return structured analysis results.

**Why this priority**: Without LLM config initialization, every `llm_calc` DAG node fails. This is a blocking bug that prevents any multi-step analysis DAG from completing.

**Independent Test**: Configure an LLM API key in Settings, submit a prompt that generates an `llm_calc` node, verify the node succeeds and returns analysis content on the canvas.

**Acceptance Scenarios**:

1. **Given** the extension starts up with a previously saved LLM configuration, **When** the DAG engine executes an `llm_calc` node, **Then** the node succeeds using the saved configuration without errors.
2. **Given** the user updates their LLM configuration in Settings, **When** they submit a new prompt that triggers an `llm_calc` node, **Then** the node uses the updated configuration.
3. **Given** no LLM configuration has been saved, **When** the DAG engine encounters an `llm_calc` node, **Then** the node fails with a clear error message visible on the canvas.

---

### User Story 2 - Visual Scrape via Canvas Webview (Priority: P2)

A user submits a prompt to compare prices from multiple websites. The DAG plan contains `scrape` nodes for each URL. Instead of scraping in invisible background tabs, the system now opens each URL as a visible embedded webview on the canvas. The user can see the pages loading, watch the extraction happen in real-time, and view the extracted content displayed alongside the webview node.

**Why this priority**: Visual scraping provides transparency — users see what the system is accessing and can verify the data source. It also avoids background tab management overhead.

**Independent Test**: Submit a multi-URL comparison prompt, verify each URL opens as an embedded webview on the canvas, verify extraction results appear in the DAG node output.

**Acceptance Scenarios**:

1. **Given** a DAG plan contains a `scrape` node, **When** the node executes, **Then** a webview is opened on the canvas showing the target URL, and the extracted content is returned as the node result.
2. **Given** a DAG plan contains multiple independent `scrape` nodes, **When** the DAG engine reaches their execution level, **Then** each scrape node opens its own webview on the canvas concurrently.
3. **Given** a scrape node targets a URL that cannot be embedded (blocked by the site), **When** the node executes, **Then** the webview shows the blocked/error state and the node result reflects the failure.
4. **Given** a scrape node depends on a previous node's result, **When** all dependencies are satisfied, **Then** the scrape webview opens and the extracted content is available for downstream `llm_calc` nodes.

---

### Edge Cases

- What happens when the LLM configuration is cleared (user removes API key) mid-session and an `llm_calc` node is already queued?
- What happens when a webview fails to load (network error, DNS failure) during a scrape operation?
- What happens when concurrent scrape nodes open multiple webviews simultaneously and the browser runs low on memory?
- What happens when the webview extraction returns empty content (page loaded but no extractable text)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tool registry MUST receive the LLM configuration when the extension loads a previously saved configuration.
- **FR-002**: The tool registry MUST receive the updated LLM configuration when the user saves new settings.
- **FR-003**: Scrape DAG nodes MUST execute visually by opening the target URL as an embedded webview on the canvas.
- **FR-004**: Scrape DAG nodes MUST return the extracted page content as the node result, available for downstream dependency interpolation.
- **FR-005**: The console.log tracing system MUST include `[DAG]` prefixed logs for scrape node execution via webview, consistent with existing logging patterns.
- **FR-006**: Failed scrape nodes (webview blocked, network error) MUST be marked as failed with an error message, and dependent nodes must be skipped.

### Key Entities

- **Tool Registry LLM Config**: The internal LLM configuration state held by the tool registry, used by `llm_calc` nodes to instantiate the LLM provider. Must be initialized on app startup and updated on settings change.
- **Scrape Webview Node**: A DAG scrape node that opens a visible embedded browser on the canvas instead of a hidden background tab. The extracted content becomes the node result for downstream nodes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `llm_calc` DAG nodes execute successfully without "LLM configuration is required" errors when a valid LLM config exists.
- **SC-002**: Scrape DAG nodes open visible webviews on the canvas, with extracted content returned as node results.
- **SC-003**: The full execution trace (config init, scrape start/success/fail) is visible in Chrome DevTools console.
- **SC-004**: Build and type-check pass with zero errors after implementation.

## Assumptions

- The `setLLMConfig` function already exists in `toolRegistry.ts` as a public method on the `ToolRegistry` class.
- The `browse_webview` tool handler already creates webview sessions, opens iframes on the canvas, and performs content extraction.
- The `handleSaveConfig` function in `App.tsx` already persists configuration to storage.
- Sites that block iframe embedding will show error/blocked states in the webview — this is acceptable for now and will be addressed in a future fix.
