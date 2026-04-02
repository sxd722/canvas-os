# Implementation Plan: Fix Iframe Targeting ID Mismatch

**Branch**: `017-fix-iframe-id-mismatch` | **Date**: 2026-04-02 | **Spec**: `specs/017-fix-iframe-id-mismatch/spec.md`
**Input**: Feature specification from `/specs/017-fix-iframe-id-mismatch/spec.md`

## Summary

Canvas node IDs and webview session IDs are created independently and never synchronized before the iframe targeting system needs to find the container. `postToIframe` and `waitForExtraction` exclusively locate iframe containers by `data-session-id`, but at the time of the initial extraction call, the session ID has not been written back to the canvas node's DOM attribute. The fix is to add `data-node-id` as the primary lookup strategy in `postToIframe`, `waitForExtraction`, and `sendInteractionToIframe`, falling back to `data-session-id` for backward compatibility.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022) + JavaScript ES2022 + React 18+
**Primary Dependencies**: Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3
**Storage**: chrome.storage.local (LLM config), chrome.storage.session (ephemeral DAG state)
**Testing**: Vitest + Chrome DevTools Protocol (CDP) on localhost:9222
**Target Platform**: Chrome Extension (MV3) — popup runs in extension page context
**Project Type**: chrome-extension (desktop-app)
**Performance Goals**: Extraction must succeed on first lookup >90% of the time (currently fails consistently)
**Constraints**: Must remain backward-compatible with webview nodes created without canvas_node_id
**Scale/Scope**: Single-file fix primarily in `toolRegistry.ts`, minor changes in `App.tsx`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MV3 CSP Compliance | PASS | No new remote CDNs, inline scripts, eval, or dynamic code execution |
| II. Local Build Pipeline | PASS | Changes are TypeScript source built by existing Vite pipeline |
| III. Remote Debugging Verification | PASS | Fix verifiable via existing CDP testing (ToolTester) |
| IV. Component Architecture | PASS | Functional components, no class components introduced |
| V. Extension API Isolation | PASS | Uses existing postMessage, no new chrome.* APIs |

## Project Structure

### Documentation (this feature)

```text
specs/017-fix-iframe-id-mismatch/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (internal — N/A for this bug fix)
```

### Source Code (repository root)

```text
src/
├── popup/
│   ├── App.tsx                          # Chat-path canvas node creation (line ~171)
│   ├── Canvas/
│   │   ├── CanvasNode.tsx               # Passes nodeId/sessionId to EmbeddedWebView
│   │   └── EmbeddedWebView.tsx          # Sets data-node-id and data-session-id attrs (line 161)
│   ├── hooks/
│   │   └── useWebviewSessions.ts        # Session ID creation: webview-${Date.now()} (line 19)
│   └── services/
│       └── toolRegistry.ts              # postToIframe (1173), waitForExtraction (1193), sendInteractionToIframe (1292), sendExtractBySelector (1368), scrape handler (868), browse_webview handler (410)
└── shared/
    └── types.ts                         # CanvasNode, WebviewSession types
```

**Structure Decision**: No new directories or files. All changes are edits to existing files.

## Complexity Tracking

No constitution violations. This is a targeted bug fix modifying 2 existing files.
