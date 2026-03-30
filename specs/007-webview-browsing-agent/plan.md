# Implementation Plan: Interactive Webview Browsing Agent

**Branch**: `007-webview-browsing-agent` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-webview-browsing-agent/spec.md`

## Summary

Build an interactive webview browsing agent that allows the LLM to autonomously browse websites through embedded iframes. The system extracts page content locally (no token cost for raw HTML) using TF-IDF semantic matching, identifies interactive elements relevant to the LLM's intent, and enables back-and-forth navigation until the target data is found. A real-time DAG visualizes the multi-step browsing workflow on the canvas.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022)
**Primary Dependencies**: React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3
**Storage**: In-memory (React state) for webview sessions; chrome.storage for extension config
**Testing**: Vitest + Chrome DevTools Protocol (CDP) on localhost:9222
**Target Platform**: Chrome Browser Extension (Chrome 86+)
**Project Type**: Chrome Extension (popup + background service worker + content scripts)
**Performance Goals**: Element extraction < 500ms per page; navigation interaction < 3s; DAG update latency < 500ms
**Constraints**: MV3 CSP compliance (no eval, no remote CDNs); max 10 interactions per webview session; TF-IDF extraction only (no embedding model weights in MVP)
**Scale/Scope**: 1-4 concurrent webview sessions; 15 elements returned per extraction; single-user desktop extension

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MV3 CSP Compliance | ✅ PASS | No eval, no remote CDNs. Content script is bundled. TF-IDF is pure JS. |
| II. Local Build Pipeline | ✅ PASS | All code in Vite pipeline. No runtime imports from external URLs. |
| III. Remote Debugging Verification | ✅ PASS | New tools testable via CDP on port 9222 using toolTester. |
| IV. Component Architecture | ✅ PASS | New components: EmbeddedWebView (extended), webview_bridge.js (new content script), semanticExtractor.ts (new service). |
| V. Extension API Isolation | ✅ PASS | Uses chrome.scripting, chrome.runtime.sendMessage, postMessage for cross-context communication. |

## Project Structure

### Documentation (this feature)

```text
specs/007-webview-browsing-agent/
├── plan.md              # This file
├── research.md          # Phase 0 output — technical decisions and rationale
├── data-model.md        # Phase 1 output — entities, types, storage strategy
├── quickstart.md        # Phase 1 output — E2E demo and developer guide
├── contracts/           # Phase 1 output — tool interface contracts
│   ├── browse_webview.md
│   ├── interact_webview.md
│   ├── navigate_webview_back.md
│   └── extract_webview_content.md
└── tasks.md             # Phase 2 output (from /speckit.tasks — NOT this command)
```

### Source Code (repository root)

```text
src/
├── popup/
│   ├── App.tsx                          # MODIFY: add webview session state, handle new tool calls
│   ├── Canvas/
│   │   ├── EmbeddedWebView.tsx          # MODIFY: add postMessage bridge, session management
│   │   └── DAGNode.tsx                  # MODIFY: add new node type labels/icons
│   ├── services/
│   │   ├── toolRegistry.ts             # MODIFY: add 4 new tool definitions + handlers
│   │   └── semanticExtractor.ts        # NEW: TF-IDF scoring engine
│   └── hooks/
│       └── useWebviewSessions.ts       # NEW: React hook for webview session state
├── background/
│   └── index.ts                         # MINOR: may need message routing for webview events
├── content/
│   ├── scraper.ts                       # EXISTING: basic page content extraction
│   └── webview_bridge.js               # NEW: content script for webview iframe DOM access
├── shared/
│   ├── types.ts                         # MODIFY: add WebviewSession, InteractiveElement, etc.
│   └── dagSchema.ts                     # MODIFY: add webview DAG node types
└── tests/
    └── webview-browsing.test.ts        # NEW: unit + integration tests

manifest.json (via vite.config)          # MODIFY: add content_scripts all_frames entry
```

**Structure Decision**: Single project structure (Chrome extension). New files added within existing `src/` layout following established patterns.

## Implementation Phases

### Phase 1: Foundation (Types + Content Script)
1. Add new types to `src/shared/types.ts` (WebviewSession, InteractiveElement, PageExtraction, message types)
2. Extend `src/shared/dagSchema.ts` with new DAGNodeType values
3. Create `src/content/webview_bridge.js` (content script for DOM extraction + interaction)
4. Update manifest to include `webview_bridge.js` with `all_frames: true`
5. Create `src/popup/services/semanticExtractor.ts` (TF-IDF scoring)
6. Write unit tests for semanticExtractor and webview_bridge

### Phase 2: Tool Handlers
7. Add 4 new tool definitions to `src/popup/services/toolRegistry.ts`
8. Implement `browse_webview` handler (creates session, opens iframe, extracts content)
9. Implement `interact_webview` handler (sends interaction command, re-extracts)
10. Implement `navigate_webview_back` handler (history.back + re-extract)
11. Implement `extract_webview_content` handler (targeted CSS selector extraction)
12. Add `executeNodeWithWorker` cases for new DAG node types

### Phase 3: UI Integration
13. Create `src/popup/hooks/useWebviewSessions.ts` hook
14. Extend `EmbeddedWebView.tsx` with postMessage bridge
15. Add webview session state management in `App.tsx`
16. Handle new tool calls in the agentic loop (`handleToolCall`)
17. Add DAG node type labels/icons for webview nodes in `DAGNode.tsx`

### Phase 4: System Prompt + End-to-End
18. Update system prompt to include webview browsing instructions for the LLM
19. Integration testing via CDP
20. E2E test: MacBook Pro price comparison flow

## Complexity Tracking

> No constitution violations. All approaches comply with MV3 CSP and local build pipeline requirements.
