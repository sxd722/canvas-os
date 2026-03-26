# Implementation Plan: Fix DAG Architecture & MV3 CSP Violations

**Branch**: `003-fix-dag-architecture` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-fix-dag-architecture/spec.md`

## Summary

Refactor DAG orchestration to align with the 4-layer architecture and fix MV3 CSP violations. Fix 5 critical issues: (1) consolidate execution engine through toolRegistry, (2) route js-execution through sandbox.html, (3) implement real LLM API calls, (4) route web-operations through background proxy, (5) implement dependency interpolation.

## Technical Context

**Language/Version**: TypeScript 5.x / JavaScript ES2022
**Primary Dependencies**: React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3 APIs
**Storage**: chrome.storage.local (persistent), chrome.storage.session (ephemeral)
**Testing**: npm test (vitest), CDP on localhost:9222
**Target Platform**: Chrome Browser Extension (MV3)
**Project Type**: Chrome Extension (popup UI + background service worker + sandbox)
**Performance Goals**: DAG node execution <5s, max 4 concurrent nodes
**Constraints**: MV3 CSP compliance (no eval, no new Function in extension pages)
**Scale/Scope**: Single-user extension, 10+ concurrent DAG nodes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MV3 CSP Compliance | ✅ PASS | All code bundled via Vite; sandbox uses CSP-exempt postMessage |
| II. Local Build Pipeline | ✅ PASS | Vite + React + Tailwind already configured |
| III. Remote Debugging Verification | ✅ PASS | CDP on localhost:9222 for verification |
| IV. Component Architecture | ✅ PASS | Functional components with hooks, TypeScript interfaces |
| V. Extension API Isolation | ✅ PASS | chrome.* APIs isolated to services, UI uses message passing |

**Special Consideration**: Sandbox execution uses `postMessage` for CSP-compliant code execution. This is compliant with MV3 because Chrome explicitly allows sandboxed pages to use `eval()` and `new Function()`.

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-dag-architecture/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── popup/
│   ├── App.tsx                    # Main app (updated handleToolCall)
│   ├── hooks/
│   │   ├── useDagEngine.ts       # Refactored: UI state manager only
│   │   ├── useSandboxExecutor.ts # Updated: support deps param
│   │   └── useArtifacts.ts        # Existing: metadata/content separation
│   ├── services/
│   │   ├── toolRegistry.ts       # Updated: sandbox execution, interpolation
│   │   ├── llmService.ts         # Existing: LLM API calls
│   │   └── toolTester.ts         # Updated: list_artifacts support
│   └── workers/
│       ├── llmCallWorker.ts      # Existing: real LLM calls
│       └── jsExecWorker.ts       # DELETE: replaced by sandbox
├── background/
│   └── index.ts                   # Existing: DAG_FETCH handler
├── sandbox/
│   └── executor.ts                # Updated: deps parameter support
└── shared/
    ├── types.ts                   # Existing
    ├── messages.ts               # Existing
    ├── storage.ts                # Existing
    └── dagSchema.ts               # Existing
```

**Structure Decision**: Single project structure with changes to existing files. The jsExecWorker.ts will be deleted as js-execution moves to sandbox.html.

## Complexity Tracking

> No violations - all changes comply with constitution principles.

| Change | Approach | Constitution Alignment |
|--------|----------|----------------------|
| Remove jsExecWorker.ts | Use sandbox.html via postMessage | MV3-compliant sandbox execution |
| Refactor useDagEngine | Pure UI state manager with callback subscription | Separates concerns from execution |

## Phase 0: Research Summary

### Decision 1: Sandbox Execution Architecture
**Decision**: Route all `js-execution` through sandbox iframe via `postMessage`
**Rationale**: `new Function()` and `eval()` violate MV3 CSP in extension pages. Sandbox pages are CSP-exempt.
**Alternatives Considered**: Web Workers (no chrome API access), eval() in popup (CSP violation)

### Decision 2: Execution Engine Architecture
**Decision**: Single entry point via `toolRegistry.executeTool()`
**Rationale**: Single source of truth for execution, clear separation of concerns.
**Alternatives Considered**: Direct execution in useDagEngine (bypasses tool system)

### Decision 3: Dependency Interpolation Pattern
**Decision**: String replacement with `$nodeId` pattern
**Rationale**: Simple, predictable, works with JSON results.
**Alternatives Considered**: Template literals (complex escaping), AST-based (overkill)

### Decision 4: LLM Call Architecture
**Decision**: Execute via Worker with direct API fetch
**Rationale**: Workers can make network requests, already implemented pattern.
**Alternatives Considered**: Main thread fetch (CORS issues)

### Decision 5: Web Operation Architecture
**Decision**: Route through background service worker
**Rationale**: Background has full CORS bypass capability via host_permissions.
**Alternatives Considered**: Direct fetch (CORS errors)

## Phase 1: Data Model & Contracts

### Key Entities (see data-model.md for full definitions)

1. **DAGNode**: Updated params to support dependency interpolation
2. **SandboxExecuteMessage**: Added deps parameter
3. **DependencyResults**: Map of node ID to execution results

### Sandbox Communication Protocol

```typescript
// Request: Popup -> Sandbox
interface SandboxExecuteMessage {
  type: 'SANDBOX_EXECUTE';
  code: string;
  timeout: number;
  deps?: Record<string, unknown>;
}

// Response: Sandbox -> Popup
interface SandboxResultMessage {
  type: 'SANDBOX_RESULT';
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}
```

## Implementation Phases

### Phase 2A: Consolidate Execution Engine (P1)
- Remove direct `useDagEngine.execute()` call from App.tsx
- Update `handleToolCall` to dispatch through `toolRegistry.executeTool()`
- Refactor `useDagEngine` to pure UI state manager
- Subscribe to DAG execution events via `registerDAGExecutionCallback`

### Phase 2B: Fix MV3 CSP Violations (P1)
- Delete `jsExecWorker.ts` (uses `eval()`)
- Update `toolRegistry.ts` to route `js-execution` through sandbox
- Update `sandbox/executor.ts` to handle `deps` parameter
- Update `useSandboxExecutor.ts` to support dependency passing

### Phase 2C: Implement Real LLM Calls (P1)
- Verify `llmCallWorker.ts` uses actual API calls (already implemented)
- Ensure `currentLLMConfig` is passed correctly
- Handle errors gracefully

### Phase 2D: Fix Web Operation CORS (P1)
- Verify `executeWebOpViaBackground` is active path (already implemented)
- Ensure all `web-operation` nodes use background proxy

### Phase 2E: Implement Dependency Interpolation (P2)
- Add `interpolateParams()` function in toolRegistry
- Update node execution to interpolate before execution
- Support interpolation in `prompt`, `url`, `code` params

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Sandbox iframe fails to load | Graceful error handling with user feedback |
| LLM API rate limits | Implement timeout and error display |
| Background worker crashes | Retry logic with error reporting |
| Circular dependencies | Already detected in topological sort |
