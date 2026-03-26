# Feature Specification: Fix DAG Architecture & MV3 CSP Violations

**Feature Branch**: `003-fix-dag-architecture`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: User description: "Refactor DAG orchestration to align with the 4-layer architecture and fix MV3 CSP violations. Fix 5 critical issues: consolidate execution engine, fix MV3 CSP violations, implement real LLM calls, fix web operation CORS, implement dependency interpolation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consolidated Execution Engine (Priority: P1)

As a developer maintaining the codebase, I want all tool calls to flow through a single execution path (toolRegistry), so that the architecture is consistent and the UI layer (useDagEngine) focuses purely on state management.

**Why this priority**: This is foundational - without proper architecture, all other fixes cannot be reliably implemented. The current bypass causes inconsistent behavior.

**Independent Test**: Can be tested by triggering a DAG execution and verifying that `toolRegistry.executeTool()` is called instead of `useDagEngine.execute()` directly.

**Acceptance Scenarios**:

1. **Given** an `execute_dag` tool call in App.tsx, **When** the tool is invoked, **Then** it dispatches through `toolRegistry.executeTool()` not `useDagEngine.execute()`
2. **Given** useDagEngine hook, **When** DAG execution events occur, **Then** it receives updates via `registerDAGExecutionCallback` subscription
3. **Given** a running DAG plan, **When** nodes update status, **Then** useDagEngine reflects UI state without executing code

---

### User Story 2 - MV3 CSP-Compliant JS Execution (Priority: P1)

As a user running model-generated JavaScript code in DAG nodes, I want the code to execute in a sandboxed iframe without CSP violations, so that the extension remains compliant with Chrome Web Store policies.

**Why this priority**: MV3 CSP violations will cause extension rejection and runtime errors. This is blocking.

**Independent Test**: Can be tested by creating a `js-execution` DAG node and verifying it executes via `sandbox.html` using `postMessage` instead of `eval()` or `new Function()`.

**Acceptance Scenarios**:

1. **Given** a `js-execution` DAG node with code, **When** executed, **Then** code runs in `sandbox.html` via `postMessage`
2. **Given** sandbox execution, **When** code completes, **Then** results return to popup via `window.parent.postMessage`
3. **Given** the jsExecWorker.ts file, **When** reviewed, **Then** no `eval()` or `new Function()` calls exist

---

### User Story 3 - Real LLM Calls (Priority: P1)

As a user executing an `llm-call` DAG node, I want actual LLM API requests to be made using my configured credentials, so that I receive real AI responses instead of mock data.

**Why this priority**: Mocked responses make the DAG orchestration feature non-functional for real use cases.

**Independent Test**: Can be tested by creating an `llm-call` node and verifying the LLM API receives a request with the configured API key.

**Acceptance Scenarios**:

1. **Given** a configured LLM API key, **When** an `llm-call` node executes, **Then** a real HTTP request is sent to the LLM endpoint
2. **Given** a successful LLM response, **When** the node completes, **Then** the actual response text is stored as the node result
3. **Given** an LLM API error, **When** the node fails, **Then** the error message is captured and displayed

---

### User Story 4 - CORS-Free Web Operations (Priority: P1)

As a user executing a `web-operation` DAG node, I want web requests to bypass CORS restrictions, so that I can fetch data from arbitrary URLs without browser security errors.

**Why this priority**: CORS errors block the primary use case of fetching web content in DAG workflows.

**Independent Test**: Can be tested by creating a `web-operation` node that fetches from a CORS-restricted URL and verifying it succeeds via the background proxy.

**Acceptance Scenarios**:

1. **Given** a `web-operation` node with a URL, **When** executed, **Then** the request goes through `chrome.runtime.sendMessage` to background
2. **Given** the background service worker, **When** it receives `DAG_FETCH`, **Then** it executes `fetch()` and returns the response
3. **Given** a CORS-restricted URL, **When** fetched via background, **Then** the response data is returned successfully

---

### User Story 5 - Dependency Interpolation (Priority: P2)

As a user building multi-step DAG workflows, I want child nodes to access parent node results in their prompts, so that data flows between dependent operations.

**Why this priority**: Enables complex workflows but individual nodes work without it.

**Independent Test**: Can be tested by creating a DAG with two nodes where the second node's prompt contains `$node1` and verifying it's replaced with the first node's result.

**Acceptance Scenarios**:

1. **Given** a child node with `$parentId` in its prompt, **When** the parent completes, **Then** the variable is replaced with the stringified parent result
2. **Given** multiple dependencies, **When** interpolating, **Then** all `$depId` patterns are replaced with their respective results
3. **Given** a dependency that failed, **When** interpolating, **Then** the child node is skipped (not executed)

---

### Edge Cases

- What happens when sandbox.html fails to load? Display error message with retry option
- What happens when LLM API rate limits are hit? Capture error, mark node failed, continue independent nodes
- What happens when a circular dependency is detected? Reject the DAG before execution starts
- What happens when dependency interpolation produces extremely long prompts? Truncate with warning

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: App.tsx MUST dispatch `execute_dag` tool calls to `toolRegistry.executeTool()`
- **FR-002**: useDagEngine MUST be a pure UI state manager subscribing via `registerDAGExecutionCallback`
- **FR-003**: `js-execution` nodes MUST execute in `sandbox.html` via `postMessage`
- **FR-004**: All `eval()` and `new Function()` calls MUST be removed from extension pages
- **FR-005**: `llm-call` nodes MUST make real HTTP requests to configured LLM endpoints
- **FR-006**: `web-operation` nodes MUST use background proxy via `DAG_FETCH` message
- **FR-007**: Child node prompts MUST have `$parentId` patterns replaced with parent results
- **FR-008**: Failed dependencies MUST cause dependent nodes to be skipped
- **FR-009**: Tool definitions in toolRegistry MUST accurately describe all available tools
- **FR-010**: jsExecWorker.ts MUST be CSP-compliant or removed if no longer needed

### Key Entities

- **DAGExecutionCallback**: Function type for receiving DAG execution events (planId, nodes, status)
- **SandboxMessage**: Message format for sandbox communication (type, code, timeout)
- **DependencyInterpolation**: Process of replacing `$nodeId` patterns with stringified results
- **ToolCall**: Unified format for all tool invocations (name, arguments)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All `js-execution` nodes execute successfully in sandbox without CSP console errors
- **SC-002**: `llm-call` nodes return actual LLM responses (not hardcoded mock strings)
- **SC-003**: `web-operation` nodes fetch data from CORS-restricted URLs successfully
- **SC-004**: Dependency interpolation correctly passes parent results to child prompts
- **SC-005**: No `eval()` or `new Function()` calls exist in popup or background contexts
- **SC-006**: useDagEngine hook contains no direct code execution logic (only state management)

## Assumptions

- Existing `sandbox.html` and `executor.ts` can be reused for `js-execution` nodes
- LLM configuration (API key, endpoint) is already stored and accessible via `getLLMConfig()`
- Background service worker already has `DAG_FETCH` handler implemented
- `registerDAGExecutionCallback` is already exported from toolRegistry
