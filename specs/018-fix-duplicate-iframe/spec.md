# Feature Specification: Fix Duplicate Iframe Bug

**Feature Branch**: `018-fix-duplicate-iframe`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User description: "Fix the duplicate iframe bug by passing canvas_node_id from App.tsx to toolRegistry.ts. 1) In src/popup/App.tsx, locate the handleToolCall function and find the if (toolCall.name === 'browse_webview') block. 2) Inside this block, declare const nodeId = generateId(); at the top. 3) Update the webViewNode creation to use id: nodeId. 4) CRITICAL: Immediately before the line result = await toolRegistry.executeTool(toolCall);, add this exact line: toolCall.arguments.canvas_node_id = nodeId;. This ensures the backend knows the UI already rendered the iframe. 5) In src/popup/services/toolRegistry.ts, verify the browse_webview handler. It MUST extract let canvasNodeId = call.arguments.canvas_node_id as string | undefined;. It should ONLY call this.addCanvasNode?.(...) if !canvasNodeId is true. Make sure canvasNodeId is properly passed to this.waitForExtraction."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single Iframe per Browse Request (Priority: P1)

When a user asks the AI to browse a webpage, the system renders exactly one embedded iframe on the canvas for that request. The canvas node is created once in the UI layer, and its ID is communicated to the backend tool handler so the handler can reuse it instead of creating a duplicate.

**Why this priority**: This is the core bug — duplicate canvas nodes cause visual clutter and confuse the user.

**Independent Test**: Trigger a browse_webview tool call via chat. Verify exactly one canvas node appears on the canvas. Verify no duplicate nodes are created after the tool completes.

**Acceptance Scenarios**:

1. **Given** the user sends a chat message that triggers browse_webview, **When** the tool executes, **Then** exactly one canvas node with an embedded iframe appears on the canvas
2. **Given** the UI has already created a canvas node with an ID, **When** the tool handler receives the canvas_node_id, **Then** the handler does NOT create a second canvas node

---

### Edge Cases

- What happens when the tool is invoked from the DAG engine (batch execution) rather than direct chat? The DAG engine must also pass canvas_node_id if it created the node.
- What happens when canvas_node_id is not provided (e.g., programmatic tool call without UI)? The handler should fall back to creating its own canvas node.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The UI layer (App.tsx) MUST generate a unique node ID and assign it to the canvas node before invoking the tool
- **FR-002**: The UI layer MUST pass the generated canvas_node_id into the tool call arguments before execution
- **FR-003**: The tool handler (toolRegistry.ts) MUST extract canvas_node_id from the tool call arguments
- **FR-004**: The tool handler MUST ONLY create a fallback canvas node when canvas_node_id is NOT provided
- **FR-005**: The tool handler MUST pass the received canvas_node_id to waitForExtraction so it targets the correct iframe

### Key Entities

- **Canvas Node ID**: A unique identifier for a node on the canvas. Created in the UI layer, passed to the backend to prevent duplicate creation.
- **Tool Call Arguments**: The arguments object passed to browse_webview, which must include canvas_node_id when the UI has already rendered the node.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Exactly one canvas node is created per browse_webview invocation from the chat UI
- **SC-002**: Zero duplicate canvas nodes appear on the canvas after any number of browse_webview calls
- **SC-003**: The correct iframe is targeted by waitForExtraction (no ID mismatch between UI node and extraction target)
