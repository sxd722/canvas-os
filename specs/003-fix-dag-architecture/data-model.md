# Data Model: Fix DAG Architecture & MV3 CSP Violations

**Feature Branch**: `003-fix-dag-architecture`
**Date**: 2026-03-26

## Entity Changes
No new entities. Changes to existing entities focus on execution flow.

## Modified Entities
### DAGNode (Updated)
```typescript
interface DAGNode {
  id: string;
  type: 'llm-call' | 'js-execution' | 'web-operation';
  params: DAGNodeParams;
  dependencies: string[];
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}
```
**Changes**: 
- `params` may now support dependency interpolation via `$nodeId` patterns
- Execution flow updated to use sandbox for `js-execution`

### DAGNodeParams (Updated)
```typescript
type DAGNodeParams =
  | { prompt: string; model?: string }  // llm-call - supports $parentId interpolation
  | { code: string; timeout?: number; deps?: Record<string, unknown> }  // js-execution - deps for interpolation
  | { url: string; action: 'fetch'; method?: string; headers?: Record<string, string>; body?: string };  // web-operation
```

**Changes**:
- Added `deps` parameter to `js-execution` for passing dependency results
- All param types support `$nodeId` string interpolation

### SandboxMessage (Updated)
```typescript
interface SandboxExecuteMessage {
  type: 'SANDBOX_EXECUTE';
  code: string;
  timeout: number;
  deps?: Record<string, unknown>;  // NEW: dependency results for interpolation
}
```

## New Entities
### DependencyResults (New)
```typescript
interface DependencyResults {
  [nodeId: string]: unknown;
}
```
**Purpose**: Stores results from completed parent nodes for interpolation into child nodes.

### InterpolationPattern (New)
```typescript
interface InterpolationPattern {
  pattern: RegExp;        // /\$nodeId/g
  replacer: (result: unknown) => string;
}
```
**Purpose**: Defines how to replace `$nodeId` patterns with actual results.

## State Transitions
### DAG Execution Flow (Updated)
```
pending -> running -> success
                  \-> error
                  \-> skipped (if dependency failed)
```

### Sandbox Execution Flow
```
idle -> executing -> completed
                    \-> timeout
                    \-> error
```

## Execution Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   App.tsx    │────▶│ toolRegistry │────▶│  useDagEngine │ (UI state only)
│ (handleTool│     │executeTool() │     │  (subscribes) │
│   Call)   │     │             │     │             │
└─────────────┘     └──────┬─────┘     └─────────────┘
                              │
                              ▼
                    ┌──────────────┐     ┌──────────────┐
                    │   Workers     │ or  │   Sandbox     │
                    │ (llm-call)   │     │ (js-execution)│
                    │ (web-op)    │     └──────────────┘
                    └──────────────┘
```

## Storage Mapping
| Entity | Storage | Key |
|--------|---------|-----|
| DAGNode | In-memory (ephemeral) | `dag_plans.{planId}.nodes` |
| DependencyResults | In-memory | `nodeResults` Map in toolRegistry |
| LLMConfig | chrome.storage.local | `llm_config` |
