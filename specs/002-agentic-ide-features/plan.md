# Implementation Plan: CanvasOS Agentic IDE Upgrade

**Branch**: `002-agentic-ide-features` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-agentic-ide-features/spec.md`

## Summary

Upgrade CanvasOS with four advanced agentic IDE features: (1) Context Optimization using metadata-only context with tool calls for content fetch, (2) DAG Task Orchestration with visual execution graphs and concurrent node processing, (3) Artifact @-Mentions with autocomplete and hover highlighting, and (4) Embedded Web Workspaces using iframes with declarativeNetRequest to bypass embedding restrictions.

## Technical Context

**Language/Version**: TypeScript 5.x / JavaScript ES2022
**Primary Dependencies**: React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3 APIs
**Storage**: chrome.storage.local (persistent), chrome.storage.session (ephemeral chat)
**Testing**: npm test (verify via Chrome DevTools Protocol on localhost:9222)
**Target Platform**: Chrome Browser Extension (MV3)
**Project Type**: Chrome Extension (popup UI + background service worker + sandbox)
**Performance Goals**: @mention autocomplete <100ms, hover highlight <50ms, DAG concurrent execution
**Constraints**: MV3 CSP compliance (no eval, no remote scripts, no inline scripts), declarativeNetRequest for header stripping
**Scale/Scope**: Single-user extension, 10+ concurrent DAG nodes, 50+ artifacts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MV3 CSP Compliance | ✅ PASS | No eval(), no remote CDNs, all code bundled via Vite |
| II. Local Build Pipeline | ✅ PASS | Vite + React + Tailwind already configured |
| III. Remote Debugging Verification | ✅ PASS | Test via CDP on localhost:9222 |
| IV. Component Architecture | ✅ PASS | Functional components with hooks, TypeScript interfaces |
| V. Extension API Isolation | ✅ PASS | chrome.* APIs isolated to services, UI uses message passing |

**Special Consideration**: `declarativeNetRequest` permission added for header stripping - this is a standard MV3 API for modifying network requests, compliant with Chrome Web Store policies.

## Project Structure

### Documentation (this feature)

```text
specs/002-agentic-ide-features/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── popup/
│   ├── App.tsx                    # Main app (updated for new features)
│   ├── main.tsx                   # Entry point
│   ├── Chat/
│   │   ├── ChatPanel.tsx          # Chat container
│   │   ├── ChatInput.tsx          # Input with @mention support
│   │   ├── ChatMessage.tsx        # Message display with @links
│   │   └── MentionDropdown.tsx    # NEW: @mention autocomplete dropdown
│   ├── Canvas/
│   │   ├── CanvasPanel.tsx        # Canvas container
│   │   ├── InfiniteCanvas.tsx     # Pan/zoom canvas
│   │   ├── CanvasNode.tsx         # Node renderer
│   │   ├── DAGNode.tsx            # NEW: DAG execution node card
│   │   └── EmbeddedWebView.tsx    # NEW: iframe web view component
│   ├── components/LLMConfig/
│   │   └── Config.tsx             # Settings modal
│   ├── services/
│   │   ├── llmService.ts          # LLM API (updated with tool calls)
│   │   ├── ocrService.ts          # OCR.space API
│   │   ├── dagExecutor.ts         # NEW: DAG execution engine
│   │   └── toolRegistry.ts        # NEW: Tool call handlers
│   ├── hooks/
│   │   ├── useSandboxExecutor.ts  # Existing sandbox hook
│   │   ├── useArtifacts.ts        # NEW: Metadata/content separation
│   │   ├── useDagEngine.ts        # NEW: DAG orchestration hook
│   │   └── useMentions.ts         # NEW: @mention state management
│   └── context/
│       └── HoverStateContext.tsx  # NEW: Global hover state for highlighting
├── background/
│   └── index.ts                   # Service worker (updated for declarativeNetRequest)
├── content/
│   └── scraper.ts                 # Content script for research
├── sandbox/
│   └── executor.ts                # Sandboxed code execution
└── shared/
    ├── types.ts                   # TypeScript interfaces (updated)
    ├── messages.ts                # Message types
    ├── storage.ts                 # Chrome storage helpers
    └── dagSchema.ts               # NEW: DAG JSON schema definitions

public/
├── manifest.json                  # Updated with declarativeNetRequest
├── sandbox.html                   # Sandbox iframe
├── rules.json                     # NEW: declarativeNetRequest rules
└── icons/                         # Extension icons
```

**Structure Decision**: Single project structure with feature-based organization. New files added to existing `src/popup/` hierarchy with new `context/` subdirectory for React Context providers.

## Complexity Tracking

> No violations - all features comply with constitution principles.

| Feature | Approach | Constitution Alignment |
|---------|----------|----------------------|
| Embedded Web Workspaces | declarativeNetRequest + iframe | MV3-compliant network modification |
| @-Mentions | Custom textarea + React Context | No external dependencies, CSP-safe |
| DAG Engine | Promise.all in hook | Pure JavaScript, sandboxed execution |
| Context Optimization | Tool calls via LLM service | Standard OpenAI-compatible format |

## Phase 0: Research Summary

### Decision 1: @-Mention Implementation
**Decision**: Custom textarea wrapper with span injection (not draft.js)
**Rationale**: draft.js is heavyweight (~150KB) and violates MV3 CSP with its dependency tree. Custom implementation with contenteditable spans is ~5KB and CSP-compliant.
**Alternatives Considered**: draft.js (too large, CSP issues), Slate.js (similar issues), TipTap (requires ProseMirror)

### Decision 2: DAG JSON Schema Format
**Decision**: Flat array format with dependency IDs
```json
[{"id": "node-1", "type": "llm-call", "params": {...}, "dependencies": []}]
```
**Rationale**: Simple to parse, easy for LLMs to generate, supports topological sort for execution order.
**Alternatives Considered**: Nested tree (harder for concurrent execution), GraphML (overkill)

### Decision 3: declarativeNetRequest Rules
**Decision**: Dynamic rule registration for user-requested URLs only
**Rationale**: Chrome limits static rules to 5,000; dynamic rules allow per-request header stripping. Rules added/removed per session.
**Alternatives Considered**: Static rules (can't cover arbitrary URLs), webRequest API (blocked in MV3)

### Decision 4: Hover State Management
**Decision**: React Context with HoverStateProvider
**Rationale**: Decouples @mention links from canvas nodes without prop drilling. Single source of truth for highlighted artifact ID.
**Alternatives Considered**: Zustand (extra dependency), URL state (overcomplicated)

## Phase 1: Data Model & Contracts

### Key Entities (see data-model.md for full definitions)

1. **DAGPlan**: Execution graph with nodes array, status, timestamps
2. **DAGNode**: Single execution unit with id, type, params, status, result, dependencies
3. **ArtifactMetadata**: Lightweight artifact representation (id, title, type, summary, size)
4. **@Mention**: Chat reference with artifactId, displayText, startIndex, endIndex
5. **EmbeddedWebView**: Canvas iframe with id, url, title, position

### Tool Call Contracts

LLM can invoke these tools via OpenAI-compatible function calling:

```typescript
// Tool: read_artifact_content
{ name: "read_artifact_content", arguments: { artifactId: string } }
// Returns: { content: string, type: string, size: number }

// Tool: open_web_view  
{ name: "open_web_view", arguments: { url: string, title?: string } }
// Returns: { viewId: string, status: "loaded" | "blocked" }

// Tool: execute_dag
{ name: "execute_dag", arguments: { nodes: DAGNodeJSON[] } }
// Returns: { planId: string, status: "running" }
```

### DAG Node Types

| Type | params | Execution |
|------|--------|-----------|
| `llm-call` | `{ prompt: string, model?: string }` | Call LLM, return text |
| `js-execution` | `{ code: string, timeout?: number }` | Run in sandbox, return result |
| `web-operation` | `{ url: string, action: "fetch" \| "screenshot" }` | Fetch/scrape, return content |

### Concurrent Execution Algorithm

```
1. Topological sort nodes by dependencies
2. Group nodes by dependency depth (level 0, 1, 2...)
3. For each level: Promise.all(all nodes in level)
4. On node completion: update status, create canvas artifact
5. On node failure: mark failed, cancel dependents, continue independents
```

## Implementation Phases

### Phase 2A: Context Optimization (P1)
- Create `useArtifacts` hook with metadata/content separation
- Update `llmService` to support tool calling
- Implement `read_artifact_content` tool handler
- Update chat context builder to use metadata only

### Phase 2B: DAG Task Orchestration (P1)
- Define DAG JSON schema in `shared/dagSchema.ts`
- Create `useDagEngine` hook with dependency resolution
- Implement `dagExecutor` service with Promise.all concurrency
- Create `DAGNode` canvas component with status indicators
- Add DAG plan detection in chat message handler

### Phase 2C: Artifact @-Mentions (P2)
- Create `HoverStateContext` provider
- Update `ChatInput` with @ detection and dropdown
- Create `MentionDropdown` component
- Update `ChatMessage` to render @links with hover handlers
- Add canvas highlight effect on hover

### Phase 2D: Embedded Web Workspaces (P2)
- Add `declarativeNetRequest` permission to manifest
- Create `rules.json` for header stripping
- Create `EmbeddedWebView` canvas component
- Implement `open_web_view` tool handler
- Handle blocked iframe errors gracefully

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| declarativeNetRequest doesn't work for all sites | Show error card with "open in new tab" fallback |
| LLM generates invalid DAG JSON | Validate schema, show parse error to user |
| Circular dependency in DAG | Detect cycles in topological sort, reject plan |
| @mention performance with many artifacts | Virtualize dropdown, limit to 10 results |
| Tool call latency | Show loading state, stream responses if supported |
