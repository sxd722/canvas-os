# Feature Specification: CanvasOS Agentic IDE Upgrade

**Feature Branch**: `002-agentic-ide-features`  
**Created**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "We are upgrading CanvasOS with advanced Agentic IDE features: Context Optimization, Embedded Web Workspaces, Artifact @-Mentions, and DAG Task Orchestration."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Context-Optimized LLM Conversations (Priority: P1)

As a user working with large artifacts (documents, code files, images), I want the chat to only send artifact metadata to the LLM by default, so that conversations remain efficient and the LLM can request full content only when needed.

**Why this priority**: This is foundational - it changes how all LLM interactions work and enables handling of large files without context overflow.

**Independent Test**: Can be tested by loading a large file, chatting about it, and verifying the LLM can fetch full content via tool call when needed.

**Acceptance Scenarios**:

1. **Given** a canvas with multiple artifacts, **When** I send a message to the LLM, **Then** only artifact titles and summaries are included in the context
2. **Given** a conversation about an artifact, **When** the LLM needs full content to answer, **Then** the LLM makes a tool call to fetch the complete artifact
3. **Given** an artifact with a large file (100KB+), **When** included in chat context, **Then** only metadata is sent (title, type, size, summary)
4. **Given** an LLM tool call requesting artifact content, **When** executed, **Then** the full content is fetched and provided to the LLM

---

### User Story 2 - DAG Task Orchestration (Priority: P1)

As a user giving complex multi-step tasks, I want the LLM to generate a visual Directed Acyclic Graph (DAG) plan that executes tasks concurrently where possible, so I can see progress and understand task dependencies.

**Why this priority**: This is the core "agentic" capability that differentiates this from basic chat - it enables autonomous multi-step execution.

**Independent Test**: Can be tested by giving a complex task like "Research React hooks, write example code, and create a summary" and verifying DAG visualization and concurrent execution.

**Acceptance Scenarios**:

1. **Given** a complex task request, **When** sent to the LLM, **Then** the LLM generates a DAG plan with nodes and dependencies
2. **Given** a DAG with independent nodes, **When** execution starts, **Then** independent nodes run concurrently
3. **Given** a DAG with dependent nodes, **When** a parent node is running, **Then** child nodes wait until parent completes
4. **Given** a DAG node of type "LLM Call", **When** executed, **Then** the result displays as text in the canvas
5. **Given** a DAG node of type "Local JS Execution", **When** executed, **Then** code runs in sandbox and displays result
6. **Given** a DAG node of type "Web/File Operation", **When** executed, **Then** a snapshot or preview displays in canvas

---

### User Story 3 - Artifact @-Mentions (Priority: P2)

As a user typing in the chat, I want to mention canvas artifacts using @ syntax, so I can explicitly reference specific items and see visual connections between chat and canvas.

**Why this priority**: Enhances user experience by making artifact references explicit and visual, but not required for core functionality.

**Independent Test**: Can be tested by creating artifacts, typing @ in chat, selecting an artifact, and verifying hover highlighting.

**Acceptance Scenarios**:

1. **Given** a canvas with artifacts, **When** I type @ in the chat input, **Then** a dropdown shows available artifacts
2. **Given** an @mention dropdown, **When** I select an artifact, **Then** a clickable @link is inserted in my message
3. **Given** a chat message with an @link, **When** I hover over the link, **Then** the corresponding artifact highlights in the canvas
4. **Given** an @mentioned artifact, **When** the message is sent, **Then** the LLM receives the artifact's full content in context

---

### User Story 4 - Embedded Web Workspaces (Priority: P2)

As a user or LLM, I want to open web URLs inside the canvas as embedded interactive views, so I can view and interact with web content without leaving the IDE.

**Why this priority**: Powerful capability for research and reference, but the core agentic features work without it.

**Independent Test**: Can be tested by requesting to open a URL and verifying it appears as an interactive iframe in the canvas.

**Acceptance Scenarios**:

1. **Given** I want to view a webpage, **When** I request "Open [URL]" in chat, **Then** an embedded web view appears in the canvas
2. **Given** an LLM researching a topic, **When** it decides to open a URL, **Then** an embedded web view is created automatically
3. **Given** an embedded web view in canvas, **When** I interact with it, **Then** I can scroll, click, and navigate within the iframe
4. **Given** multiple embedded web views, **When** displayed on canvas, **Then** each shows a snapshot/preview thumbnail and can be expanded

---

### Edge Cases

- What happens when an artifact is deleted while an @mention to it exists in chat? The @link becomes a strikethrough "deleted artifact" placeholder
- How does the system handle a DAG with circular dependencies? The system rejects the DAG and displays an error before execution
- What happens when a web URL cannot be embedded (X-Frame-Options blocking)? An error card shows with a clickable link to open in new tab
- How does context optimization handle binary files (images, PDFs)? Images use OCR summary; PDFs show first page preview with text summary
- What happens when a DAG node execution fails? Dependent nodes are cancelled; independent nodes continue; user sees failure status

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST include only artifact metadata (id, title, type, summary, size) in default chat context
- **FR-002**: System MUST provide a tool call mechanism for LLMs to fetch full artifact content by ID
- **FR-003**: System MUST parse LLM responses for DAG plans in a defined format
- **FR-004**: System MUST execute DAG nodes respecting dependency order (parents before children)
- **FR-005**: System MUST execute DAG nodes without dependencies concurrently
- **FR-006**: System MUST support three DAG node types: LLM Call, Local JS Execution, Web/File Operation
- **FR-007**: System MUST display DAG execution progress visually on the canvas
- **FR-008**: System MUST provide an @mention autocomplete dropdown when user types @ in chat
- **FR-009**: System MUST highlight canvas artifacts when hovering over @links in chat messages
- **FR-010**: System MUST send full content of @mentioned artifacts to the LLM
- **FR-011**: System MUST allow users to open arbitrary URLs as embedded web views in canvas
- **FR-012**: System MUST allow LLMs to open URLs as embedded web views via tool call
- **FR-013**: System MUST display execution results from DAG nodes as canvas artifacts
- **FR-014**: System MUST handle DAG node failures gracefully without crashing the entire orchestration
- **FR-015**: System MUST validate DAG structure and reject circular dependencies

### Key Entities

- **DAGPlan**: A directed acyclic graph containing nodes and edges (dependencies). Has a unique ID, creation timestamp, and status (pending, running, completed, failed).
- **DAGNode**: A single execution unit in a DAG. Has: id, type (llm-call | js-execution | web-operation), inputs, outputs, status, dependencies (list of node IDs).
- **ArtifactMetadata**: Lightweight representation of a canvas artifact. Has: id, title, type, summary (auto-generated or user-defined), size, createdAt.
- **@Mention**: A reference to an artifact in chat text. Has: artifactId, displayText, position in message.
- **EmbeddedWebView**: An iframe-based web view in canvas. Has: id, url, title, snapshot, lastAccessed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: LLM context size is reduced by at least 80% when multiple large artifacts exist on canvas (compared to previous full-content approach)
- **SC-002**: Users can complete complex multi-step tasks (3+ steps) with a single request and see visual DAG progress within 5 seconds of request
- **SC-003**: DAG nodes without dependencies execute concurrently, with at least 2 nodes running simultaneously when available
- **SC-004**: @mention autocomplete appears within 100ms of typing @
- **SC-005**: Hover highlighting on canvas artifacts occurs within 50ms of hovering over @links
- **SC-006**: Embedded web views load and become interactive within 3 seconds for standard web pages
- **SC-007**: 90% of users successfully reference artifacts via @mentions on first attempt
- **SC-008**: DAG execution continues successfully even when non-critical nodes fail

## Assumptions

- LLM providers support function/tool calling (OpenAI-compatible format)
- Web pages allowing iframe embedding can be displayed; blocked pages show an error message with link
- Binary files (images) use OCR-generated summaries as their metadata representation
- DAG plans are generated by the LLM in a structured JSON format
- The existing sandbox executor can be extended for DAG node execution
- Maximum concurrent DAG node execution is limited to prevent resource exhaustion (default: 4)
