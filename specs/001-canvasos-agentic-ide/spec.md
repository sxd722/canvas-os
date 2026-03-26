# Feature Specification: CanvasOS Agentic IDE

**Feature Branch**: `001-canvasos-agentic-ide`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Build a Chrome Extension called CanvasOS that acts as an Agentic IDE. The UI will be a React app split into a 30% Chat interface (left) and 70% infinite Canvas (right). It must have a Load Local File button using the window.showOpenFilePicker() API to read files and display them on the canvas. It must include an automation tool where if a user types Research [URL], the extension invisibly opens a background tab, injects a script to scrape document.body.innerText, closes the tab, and summarizes the text on the Canvas. Finally, it must support executing LLM-generated JavaScript safely via a hidden sandboxed iframe (sandbox.html) using postMessage for two-way communication."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chat Interface with Infinite Canvas (Priority: P1)

A user opens the CanvasOS extension and sees a split-view interface. On the left (30% width), a chat panel allows conversational interaction with an AI agent. On the right (70% width), an infinite canvas displays content, notes, and artifacts generated during the conversation. The user can type messages to the AI, receive responses, and see relevant content appear on the canvas.

**Why this priority**: This is the core agentic interaction model - without chat and canvas, there is no product. All other features build upon this foundation.

**Independent Test**: Open extension, verify 30/70 split layout, send a chat message, verify response appears in chat panel and any generated content appears on canvas.

**Acceptance Scenarios**:

1. **Given** the extension is installed and opened, **When** the popup loads, **Then** a split-view appears with 30% chat panel on left and 70% canvas on right.
2. **Given** the chat interface is visible, **When** a user types a message and submits, **Then** the message appears in the chat history and the AI responds.
3. **Given** the AI generates visual content, **When** content is created, **Then** it appears as a node/card on the infinite canvas.
4. **Given** the canvas is displayed, **When** the user drags or pans, **Then** the canvas scrolls infinitely in all directions.

---

### User Story 2 - Load Local Files to Canvas (Priority: P2)

A user wants to work with local files in their agentic workflow. They click a "Load Local File" button, which opens the native file picker. After selecting a file, the file contents are read and displayed as a new node on the canvas. The AI agent can then analyze, summarize, or manipulate the file content.

**Why this priority**: File integration is essential for an IDE workflow. Users need to bring their own content into the agentic environment.

**Independent Test**: Click "Load Local File", select a text file, verify file content appears as a new card/node on the canvas.

**Acceptance Scenarios**:

1. **Given** the canvas is displayed, **When** the user clicks "Load Local File", **Then** the native file picker opens.
2. **Given** the file picker is open, **When** the user selects a file and confirms, **Then** the file contents are read and displayed on the canvas.
3. **Given** a file is loaded, **When** displayed on canvas, **Then** the filename and content preview are visible.
4. **Given** a file load fails (permission denied, unreadable format), **When** an error occurs, **Then** a user-friendly error message appears.

---

### User Story 3 - Research URL Automation (Priority: P3)

A user wants to quickly research a webpage without leaving the IDE. They type "Research https://example.com" in the chat. The extension invisibly opens the URL in a background tab, extracts the page's text content, closes the tab, and displays a summary on the canvas.

**Why this priority**: Web research automation enhances productivity but is not core to the chat/canvas foundation.

**Independent Test**: Type "Research [valid URL]" in chat, verify a summary card appears on canvas without visible browser tab activity.

**Acceptance Scenarios**:

1. **Given** the chat input is active, **When** user types "Research [URL]" and submits, **Then** the system opens the URL in a background tab.
2. **Given** the background tab loads, **When** the page is ready, **Then** a script extracts document.body.innerText.
3. **Given** text is extracted, **When** extraction completes, **Then** the background tab closes automatically.
4. **Given** text is extracted, **When** summarization completes, **Then** a summary appears as a canvas node.
5. **Given** the URL is invalid or unreachable, **When** the operation fails, **Then** an error message appears in chat.

---

### User Story 4 - Safe Code Execution Sandbox (Priority: P4)

The AI agent may generate JavaScript code that needs to be executed. When code is generated, it runs in a hidden sandboxed iframe with restricted permissions. Results are communicated back to the main extension via postMessage, ensuring the extension itself remains secure.

**Why this priority**: Code execution is powerful but requires careful security implementation. It can be delivered after core features are stable.

**Independent Test**: Trigger AI to generate executable code, verify code runs in sandbox and results return to main context without errors.

**Acceptance Scenarios**:

1. **Given** the AI generates JavaScript code, **When** execution is requested, **Then** the code runs inside a hidden sandboxed iframe.
2. **Given** the sandboxed iframe is created, **When** it initializes, **Then** it has sandbox attributes restricting scripts only (no forms, no popups, no same-origin).
3. **Given** code executes in the sandbox, **When** execution completes or errors, **Then** results are sent via postMessage to the parent.
4. **Given** the parent receives a postMessage, **When** a valid result message arrives, **Then** the result is displayed on canvas or in chat.
5. **Given** malicious code attempts escape, **When** sandbox restrictions apply, **Then** the code cannot access extension APIs or user data.

---

### Edge Cases

- What happens when the user's browser does not support `showOpenFilePicker()` (older browsers)?
  - Fallback: Display an error message indicating the feature requires a modern browser.
- What happens when a Research URL takes too long to load?
  - Timeout after 30 seconds and display an error message.
- What happens when the canvas has many nodes and performance degrades?
  - Implement virtualization or lazy loading for canvas nodes.
- What happens when sandboxed code enters an infinite loop?
  - Implement execution timeout (e.g., 10 seconds) and terminate with error.
- What happens when postMessage receives malformed data?
  - Validate message structure and ignore invalid messages.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a split-view UI with 30% chat panel (left) and 70% infinite canvas (right) when the extension popup opens.
- **FR-002**: Users MUST be able to send text messages via the chat interface and receive AI responses.
- **FR-003**: System MUST display AI-generated content as nodes/cards on the infinite canvas.
- **FR-004**: Canvas MUST support infinite panning in all directions.
- **FR-005**: System MUST provide a "Load Local File" button that opens the native file picker via `window.showOpenFilePicker()`.
- **FR-006**: System MUST read selected file contents and display them as a canvas node.
- **FR-007**: System MUST recognize chat input pattern "Research [URL]" to trigger web research automation.
- **FR-008**: System MUST open target URLs in background tabs for research without user-visible browser activity.
- **FR-009**: System MUST inject a content script into research tabs to extract `document.body.innerText`.
- **FR-010**: System MUST close research tabs automatically after content extraction.
- **FR-011**: System MUST display research summaries as canvas nodes.
- **FR-012**: System MUST execute LLM-generated JavaScript in a sandboxed iframe with restricted permissions.
- **FR-013**: Sandbox iframe MUST use `sandbox="allow-scripts"` attribute only.
- **FR-014**: System MUST use `postMessage` for two-way communication between sandbox and main extension context.
- **FR-015**: System MUST validate postMessage origin and structure before processing.
- **FR-016**: System MUST display execution results or errors from sandbox in chat or canvas.
- **FR-017**: System MUST handle all errors gracefully with user-friendly messages.

### Key Entities

- **ChatMessage**: Represents a single message in the chat history. Attributes: role (user/assistant), content, timestamp.
- **CanvasNode**: Represents a visual element on the canvas. Attributes: id, type (text/file/summary/code-result), content, position (x, y), size.
- **ResearchTask**: Represents a web research operation. Attributes: url, status (pending/loading/extracting/complete/error), extractedText, summary.
- **SandboxExecution**: Represents a code execution request. Attributes: code, status (pending/running/complete/error), result, duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open the extension and see the 30/70 split layout within 2 seconds of clicking the extension icon.
- **SC-002**: Chat messages receive AI responses within 5 seconds of submission (network-dependent).
- **SC-003**: Local files under 1MB load and display on canvas within 3 seconds of selection.
- **SC-004**: Research automation completes (open, scrape, close, summarize) within 30 seconds for standard web pages.
- **SC-005**: Sandbox code execution completes within 10 seconds or times out with clear error.
- **SC-006**: Canvas supports at least 100 nodes without noticeable performance degradation (panning remains smooth).
- **SC-007**: 95% of user interactions (chat, file load, research) complete without requiring a page reload or extension restart.

## Assumptions

- The user has a valid LLM API key or backend service configured for AI chat responses (integration details TBD during planning).
- The user is using a modern Chrome browser (version 86+) that supports `showOpenFilePicker()` and Manifest V3.
- Research URLs are publicly accessible without authentication.
- File types supported initially are text-based (txt, md, json, js, ts, html, css). Binary files may require future enhancement.
- The sandbox iframe is hosted within the extension (sandbox.html bundled locally) per MV3 CSP requirements.
