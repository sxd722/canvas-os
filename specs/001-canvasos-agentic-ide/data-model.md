# Data Model: CanvasOS Agentic IDE

**Feature Branch**: `001-canvasos-agentic-ide`
**Date**: 2026-03-24

## Entities

### ChatMessage

Represents a single message in the chat history.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (UUID) |
| role | 'user' \| 'assistant' | Message sender |
| content | string | Message text content |
| timestamp | number | Unix timestamp (ms) |
| metadata? | object | Optional: token count, model info |

**Validation Rules**:
- `content` MUST not be empty
- `role` MUST be 'user' or 'assistant'
- `timestamp` MUST be a valid number > 0

**State Transitions**: None (immutable after creation)

---

### CanvasNode

Represents a visual element on the infinite canvas.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (UUID) |
| type | CanvasNodeType | Node content type |
| content | string \| object | Node payload (text, file data, etc.) |
| position | { x: number, y: number } | Canvas coordinates |
| size | { width: number, height: number } | Node dimensions |
| title? | string | Optional display title |
| createdAt | number | Creation timestamp |
| source? | { type: string, ref: string } | Origin reference (chat message, file, etc.) |

**CanvasNodeType Enum**:
- `text` - Plain text content
- `file` - Loaded file content
- `summary` - Research summary
- `code-result` - Sandbox execution result
- `markdown` - Markdown-formatted content

**Validation Rules**:
- `position.x` and `position.y` MUST be finite numbers
- `size.width` and `size.height` MUST be positive numbers
- `content` type MUST match `type` field expectations

**State Transitions**: 
- Created → Updated (position/content changes) → Deleted

---

### ResearchTask

Represents a web research operation triggered by "Research [URL]" command.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (UUID) |
| url | string | Target URL to research |
| status | ResearchStatus | Current operation state |
| tabId? | number | Background tab ID (during execution) |
| extractedText? | string | Scraped page content |
| summary? | string | Generated summary |
| error? | string | Error message if failed |
| createdAt | number | Creation timestamp |
| completedAt? | number | Completion timestamp |

**ResearchStatus Enum**:
- `pending` - Queued for execution
- `loading` - Tab opened, page loading
- `extracting` - Content being scraped
- `summarizing` - Generating summary
- `complete` - Successfully finished
- `error` - Failed with error

**State Transitions**:
```
pending → loading → extracting → summarizing → complete
    ↓         ↓          ↓            ↓
  error    error      error        error
```

---

### SandboxExecution

Represents a code execution request in the sandboxed iframe.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (UUID) |
| code | string | JavaScript code to execute |
| status | ExecutionStatus | Current execution state |
| result? | unknown | Execution return value |
| error? | string | Error message if failed |
| duration? | number | Execution time in ms |
| timeout | number | Maximum execution time |
| createdAt | number | Creation timestamp |

**ExecutionStatus Enum**:
- `pending` - Queued for execution
- `running` - Currently executing
- `complete` - Successfully finished
- `error` - Failed with error
- `timeout` - Exceeded time limit

**State Transitions**:
```
pending → running → complete
    ↓        ↓
  error   error/timeout
```

---

### LLMConfig

Configuration for LLM API integration.

| Field | Type | Description |
|-------|------|-------------|
| provider | 'openai' \| 'anthropic' \| 'custom' | API provider |
| apiKey | string | API authentication key |
| endpoint? | string | Custom endpoint URL |
| model | string | Model identifier |
| maxTokens? | number | Maximum response tokens |
| temperature? | number | Response randomness (0-2) |

**Storage**: Persisted in `chrome.storage.local`

---

### CanvasState

Runtime state for canvas viewport.

| Field | Type | Description |
|-------|------|-------------|
| offset | { x: number, y: number } | Current pan offset |
| scale | number | Zoom level (0.1 - 3.0) |
| selectedNodeId? | string | Currently selected node |

**Persistence**: Optionally saved to `chrome.storage.local` for session restoration

## Entity Relationships

```
ChatMessage (1) ←→ (0..*) CanvasNode
  - A chat message can create zero or more canvas nodes
  - CanvasNode.source references the originating ChatMessage

ResearchTask (1) → (1) CanvasNode
  - A completed research task creates one summary node

SandboxExecution (1) → (0..1) CanvasNode
  - A code execution can create a result node
```

## Storage Strategy

| Entity | Storage | Rationale |
|--------|---------|-----------|
| ChatMessage | chrome.storage.session | Ephemeral, cleared on browser close |
| CanvasNode | chrome.storage.local | Persisted across sessions |
| ResearchTask | Memory only | Transient during execution |
| SandboxExecution | Memory only | Transient during execution |
| LLMConfig | chrome.storage.local | Persisted user configuration |
| CanvasState | chrome.storage.local | Persisted for session restoration |

**Quota Considerations**:
- `chrome.storage.local` default: 10MB
- `chrome.storage.session` default: 10MB
- Estimated per-session usage: <1MB (100 nodes × ~1KB each)
