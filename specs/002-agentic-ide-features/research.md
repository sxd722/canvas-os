# Research: CanvasOS Agentic IDE Upgrade

**Feature Branch**: `002-agentic-ide-features`
**Date**: 2026-03-24

## Research Questions

### 1. @-Mention Text Editor Implementation

**Decision**: Custom textarea wrapper with span injection (not draft.js)

**Rationale**:
- draft.js adds ~150KB to bundle and has complex dependencies
- TipTap/ProseMirror also have CSP compliance concerns
- Custom implementation with contenteditable spans is ~5KB
- We only need: @ detection, span highlighting, hover events
- React refs + selection API provide all needed control

**Implementation Approach**:
```typescript
// Custom MentionInput component
- Use hidden textarea for actual input
- Overlay div with rendered content (spans for mentions)
- On @: show dropdown, on select: insert span
- onMouseEnter on spans: update HoverStateContext
```

**Alternatives Considered**:
| Library | Rejected Because |
|---------|------------------|
| draft.js | ~150KB, complex dependency tree, CSP concerns |
| Slate.js | Requires React 16.8+ but adds 80KB |
| TipTap | ProseMirror core + extensions = 100KB+ |
| Lexical | Facebook's new editor, still ~50KB min |

### 2. DAG Execution Concurrency

**Decision**: Promise.all with leveled execution

**Rationale**:
- Topological sort produces dependency levels
- All nodes at same level can run concurrently
- Promise.all provides native concurrency
- No need for worker threads (sandbox handles JS execution)
- Maximum 4 concurrent nodes prevents resource exhaustion

**Algorithm**:
```
1. Kahn's algorithm for topological sort
2. Group by depth level: [[A,B,C], [D,E], [F]]
3. For each level: await Promise.all(nodes.map(execute))
4. Collect results, create artifacts, update UI
```

### 3. declarativeNetRequest for iframe Embedding

**Decision**: Use declarativeNetRequest with REMOVE action

**Rationale**:
- MV3 deprecated webRequest for header modification
- declarativeNetRequest can strip response headers
- Rules defined in static JSON file
- Removes X-Frame-Options and CSP frame-ancestors

**Rule Configuration**:
```json
{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "modifyHeaders",
    "responseHeaders": [
      { "header": "X-Frame-Options", "operation": "remove" },
      { "header": "Content-Security-Policy", "operation": "remove" }
    ]
  },
  "condition": {
    "urlFilter": "*",
    "resourceTypes": ["sub_frame"]
  }
}
```

**Caveats**:
- Some sites use frame-busting JavaScript (not header-based)
- For those, show error with "open in new tab" option
- Permission required: `declarativeNetRequest`

### 4. LLM Tool Calling Format

**Decision**: OpenAI-compatible function calling format

**Rationale**:
- OpenAI, GLM, and Anthropic all support this format
- Well-documented and widely implemented
- Easy to extend with new tools
- Structured JSON for parameters

**Format**:
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read_artifact_content",
        "description": "Fetch full content of a canvas artifact",
        "parameters": {
          "type": "object",
          "properties": {
            "artifactId": { "type": "string" }
          },
          "required": ["artifactId"]
        }
      }
    }
  ]
}
```

**Provider Support**:
| Provider | Tool Calling | Format |
|----------|--------------|--------|
| OpenAI | ✅ Yes | tools array |
| GLM | ✅ Yes | tools array |
| Anthropic | ✅ Yes | tools array (via messages API) |

### 5. React Context for Hover State

**Decision**: Single HoverStateContext with hoveredNodeId

**Rationale**:
- Simple primitive state: `hoveredNodeId: string | null`
- No complex state management needed
- Performance: 50ms target easily met
- Single source of truth for canvas highlighting

**Implementation**:
```typescript
interface HoverState {
  hoveredNodeId: string | null;
  setHovered: (id: string | null) => void;
}

const HoverStateContext = createContext<HoverState>({
  hoveredNodeId: null,
  setHovered: () => {}
});
```

## Summary

All research questions resolved. No NEEDS CLARIFICATION items remain. Ready for Phase 1 design artifacts.
