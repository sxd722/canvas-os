# Data Model: CanvasOS Agentic IDE Upgrade

**Feature Branch**: `002-agentic-ide-features`
**Date**: 2026-03-24

## Entity Definitions

### ArtifactMetadata (New)

Lightweight representation for LLM context optimization.

```typescript
interface ArtifactMetadata {
  id: string;
  title: string;
  type: CanvasNodeType | 'web-view' | 'dag-node';
  summary: string;           // Auto-generated or user-defined
  size: number;              // Content size in bytes
  createdAt: number;
  mentionedIn?: string[];    // Chat message IDs that @mention this
}
```

**Validation Rules**:
- `id`: Required, unique, format `timestamp-random`
- `title`: Required, max 100 characters
- `summary`: Required, max 500 characters, auto-truncated
- `size`: Required, >= 0

### DAGPlan (New)

Represents a directed acyclic graph execution plan.

```typescript
interface DAGPlan {
  id: string;
  nodes: DAGNode[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  completedAt?: number;
  triggeredBy: string;       // Chat message ID
}
```

**State Transitions**:
```
pending -> running -> completed
                 \-> failed
                 \-> cancelled
```

### DAGNode (New)

Single execution unit within a DAG.

```typescript
interface DAGNode {
  id: string;
  type: 'llm-call' | 'js-execution' | 'web-operation';
  params: DAGNodeParams;
  dependencies: string[];    // Node IDs this depends on
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  artifactId?: string;       // Canvas artifact created from result
}

type DAGNodeParams =
  | { type: 'llm-call'; prompt: string; model?: string }
  | { type: 'js-execution'; code: string; timeout?: number }
  | { type: 'web-operation'; url: string; action: 'fetch' | 'screenshot' };
```

**Validation Rules**:
- `id`: Required, unique within plan
- `dependencies`: Must reference existing node IDs in same plan
- No circular dependencies (validated before execution)
- `params` must match `type` discriminant

### @Mention (New)

Reference to an artifact in chat text.

```typescript
interface Mention {
  artifactId: string;
  displayText: string;       // e.g., "@myfile.txt"
  startIndex: number;
  endIndex: number;
}

interface ChatMessage {
  // ... existing fields
  mentions?: Mention[];      // Extracted @mentions
}
```

**Validation Rules**:
- `artifactId`: Must reference existing artifact
- Ranges must not overlap within same message
- `displayText` includes @ prefix

### EmbeddedWebView (New)

Iframe-based web view in canvas.

```typescript
interface EmbeddedWebView extends CanvasNode {
  type: 'web-view';
  content: {
    url: string;
    title: string;
    status: 'loading' | 'loaded' | 'blocked' | 'error';
    lastAccessed: number;
    blockedReason?: string;
  };
}
```

**State Transitions**:
```
loading -> loaded
        \-> blocked (X-Frame-Options/CSP)
        \-> error (network failure)
```

### CanvasNode (Updated)

Extended to support new node types.

```typescript
type CanvasNodeType = 
  | 'text' 
  | 'file' 
  | 'summary' 
  | 'code-result' 
  | 'markdown'
  | 'web-view'      // NEW
  | 'dag-node';     // NEW

interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  content: string | object;
  position: { x: number; y: number };
  size: { width: number; height: number };
  title?: string;
  createdAt: number;
  source?: { type: string; ref: string };
  metadata?: ArtifactMetadata;  // NEW: cached metadata
}
```

## Entity Relationships

```
ChatMessage 1--* Mention *--1 CanvasNode
                    |
                    v
              ArtifactMetadata

DAGPlan 1--* DAGNode *--1 CanvasNode (result)
     |           |
     v           v
ChatMessage   CanvasNode (output artifacts)

EmbeddedWebView --|> CanvasNode
```

## Storage Mapping

| Entity | Storage | Key |
|--------|---------|-----|
| CanvasNode | chrome.storage.local | `canvas_nodes` |
| ChatMessage | chrome.storage.session | `chat_messages` |
| DAGPlan | chrome.storage.session | `dag_plans` (ephemeral) |
| LLMConfig | chrome.storage.local | `llm_config` |
| CanvasState | chrome.storage.local | `canvas_state` |

## JSON Schema for LLM DAG Output

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "type", "params", "dependencies"],
    "properties": {
      "id": { "type": "string" },
      "type": { 
        "type": "string", 
        "enum": ["llm-call", "js-execution", "web-operation"] 
      },
      "params": { "type": "object" },
      "dependencies": { 
        "type": "array", 
        "items": { "type": "string" } 
      }
    }
  }
}
```

## Index/Query Patterns

1. **Get artifact metadata for LLM context**: Filter `canvas_nodes`, map to `ArtifactMetadata`
2. **Get artifact content by ID**: Find node by id, return `content`
3. **Get pending DAG nodes**: Filter `dag_plans[].nodes` by `status === 'pending'`
4. **Get nodes at dependency level**: Topological sort, group by depth
5. **Find mentions in message**: Parse `content` for `@[id]` patterns
