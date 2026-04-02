# Implementation Plan: Fix Iframe Targeting

**Branch**: `015-fix-iframe-targeting` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-fix-iframe-targeting/spec.md`

## Summary

Fix three iframe targeting bugs in the webview communication system: (1) session ID / canvas node ID mismatch in `postToIframe`, (2) fragile URL-based iframe lookup in `waitForExtraction`, and (3) missing session-to-iframe mapping. The fix introduces a `sessionId` data attribute on iframe containers and a `canvasNodeId` field on `WebviewSession` to create a reliable bidirectional mapping.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022) + JavaScript ES2022
**Primary Dependencies**: React 18+, Vite 5.x, Chrome Extensions MV3, Tailwind CSS 3.x
**Storage**: In-memory (React state for sessions); chrome.storage for extension config
**Testing**: Vitest (unit), Chrome DevTools Protocol on localhost:9222 (functional)
**Target Platform**: Chrome Extension (MV3) popup + content scripts
**Project Type**: Chrome Extension (bug fix)
**Performance Goals**: No regression — iframe targeting must be <5ms (DOM query)
**Constraints**: MV3 CSP compliance (no eval, no inline scripts, no remote CDNs)
**Scale/Scope**: Affects ~5 files, ~15 methods in toolRegistry.ts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MV3 CSP Compliance | PASS | Fix uses only DOM queries and postMessage — no eval, no inline scripts, no remote CDNs |
| II. Local Build Pipeline | PASS | No new dependencies; changes are TypeScript/React only, built via Vite |
| III. Remote Debugging Verification | PASS | Fix can be verified via CDP: run `execute_dag` with scrape nodes and check extraction results |
| IV. Component Architecture | PASS | Changes are scoped to existing components; EmbeddedWebView gets a new prop, ToolRegistry gets session-to-node mapping |
| V. Extension API Isolation | PASS | No new permissions; uses existing postMessage and DOM APIs |

**Gate Result**: PASS — all principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/015-fix-iframe-targeting/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output
```

### Source Code (repository root)

```text
src/
├── popup/
│   ├── Canvas/
│   │   ├── EmbeddedWebView.tsx    # Add data-session-id, accept sessionId/channelNonce props
│   │   └── CanvasNode.tsx         # Pass sessionId to EmbeddedWebView for web-view nodes
│   ├── services/
│   │   └── toolRegistry.ts        # Fix postToIframe, waitForExtraction, add session-to-node mapping
│   └── App.tsx                    # Wire session mapping (if needed)
├── shared/
│   └── types.ts                   # Add canvasNodeId to WebviewSession
└── content/
    └── webview_bridge.js          # No changes needed (already works correctly)
```

**Structure Decision**: Single project — Chrome Extension. Changes span popup components and shared types only.

## Complexity Tracking

> No violations — straightforward bug fix with no architectural changes needed.
