# Research: Fix DAG Architecture & MV3 CSP Violations

**Feature Branch**: `003-fix-dag-architecture`
**Date**: 2026-03-26

## Research Questions

### 1. Sandbox Execution Architecture for Chrome Extensions MV3
**Decision**: Use sandbox iframe with postMessage communication
**Rationale**: 
- Chrome MV3 CSP prohibits `eval()` and `new Function()` in extension pages
- Sandbox pages (`sandbox.html`) are exempt from these restrictions
- `postMessage` allows secure cross-origin communication
- Existing `useSandboxExecutor` hook already implements this pattern
**Implementation Approach**:
1. Load sandbox.html in hidden iframe
2. Send `SANDBOX_EXECUTE` message with code and dependencies
3. Receive `SANDBOX_RESULT` message with execution result
4. Handle timeouts and errors gracefully
**Alternatives Considered**:
| Approach | Rejected Because |
|------------|---------------------|
| Web Workers | Cannot access chrome APIs, still subject to sandbox restrictions |
| eval() in popup | CSP violation, causes runtime errors |
| Service Worker | No DOM access, cannot execute arbitrary code |

### 2. DAG Execution Engine Architecture
**Decision**: Single entry point via `toolRegistry.executeTool()`
**Rationale**:
- All tool calls flow through one consistent path
- Clear separation: toolRegistry handles execution, useDagEngine handles UI state
- useDagEngine subscri to execution events via `registerDAGExecutionCallback`
- This pattern already exists in the codebase, needs to be properly utilized
**Implementation Approach**:
1. App.tsx dispatches `execute_dag` to `toolRegistry.executeTool()`
2. toolRegistry orchestrates DAG execution
3. useDagEngine subscribes to updates via callback
4. Canvas nodes update based on DAG events
**Alternatives Considered**:
| Approach | Rejected Because |
|------------|---------------------|
| Direct useDagEngine.execute() | Bypasses tool system, inconsistent |
| Multiple execution paths | Confusing, hard to maintain |

### 3. Dependency Interpolation Pattern
**Decision**: String replacement with `$nodeId` pattern
**Rationale**:
- Simple and predictable for LLMs to generate
- Works with JSON results (stringified)
- Already partially implemented in `executeWebOpViaBackground`
**Implementation Approach**:
1. Before executing node, collect parent results
2. Replace `$nodeId` patterns in params with JSON.stringify(result)
3. Support interpolation in: `prompt`, `url`, `code`
**Alternatives Considered**:
| Approach | Rejected Because |
|------------|---------------------|
| Template literals | Complex escaping, hard to debug |
| AST-based replacement | Overkill for simple string replacement |

### 4. LLM Call Architecture
**Decision**: Execute in Worker thread with direct API fetch
**Rationale**:
- Workers can make network requests without CORS issues
- `llmCallWorker.ts` already implements this correctly
- Config passed via message from main thread
**Implementation Approach**:
1. Worker receives execution message with config
2. Worker makes fetch request to LLM API
3. Worker posts result back to main thread
**Alternatives Considered**:
| Approach | Rejected Because |
|------------|---------------------|
| Main thread fetch | May block UI, subject to CORS |
| Background fetch | More complex message passing, worker is simpler |

### 5. Web Operation CORS Bypass
**Decision**: Use background service worker via `DAG_FETCH` message
**Rationale**:
- Background script has `host_permissions` for cross-origin requests
- `declarativeNetRequest` handles header stripping for iframe embedding
- Already implemented in `background/index.ts`
**Implementation Approach**:
1. toolRegistry sends `DAG_FETCH` message to background
2. Background makes fetch request
3. Response sent back via sendResponse
**Alternatives Considered**:
| Approach | Rejected Because |
|------------|---------------------|
| Direct fetch in popup | CORS errors |
| Proxy server | Additional infrastructure complexity |

## Summary
All research questions resolved. Ready for Phase 1 design artifacts.
