# Implementation Plan: Webview Content Retrieval for LLM Task Completion

**Branch**: `004-webview-content-retrieval` | **Date**: 2026-03-26 | **Spec**: [spec.md](../spec.md)

## Summary
llM initiates webview tool to load page, extract content, and notify LLM via callback so LLM can complete task based on it.

## Technical Context
**Language/Version**: TypeScript 5.x / JavaScript ES2022 + React 18+ Vite 5.x + Tailwind CSS 3.x
**Primary Dependencies**: React 18, Vite,5.x, Tailwind CSS, chrome Extensions MV3 APIs, chrome.storage API, Vitest for unit tests
**Target Platform**: Chrome Browser Extension (MV3)
**Project Type**: Chrome Extension (popup UI + service worker)
**Performance Goals**: < 5s response time for content retrieval, < 30s for 90% success rate
**Constraints**: < 10kb max content size, content truncation to no eval/new function, MV3 CSP compliant
**Scale/Scope**: Single popup, small extension

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design*

| Principle | Status | Notes |
|---------------|------------|----------------------------|--------------|---------------|------------|---------------------------|IV. Component Architecture | ✓ | No violations - functional components, hooks, isolated state, see constitution.md
    - MV3 CSP Compliance (Principle I): No remote CDNs, all assets bundled locally
    - No inline scripts (all JavaScript in separate files)
    - NO `eval()` /`new Function()` constructor forms are dynamic code execution are prohibited in extension pages (background, popup, options, content scripts) run in sandbox.html (MV3 CSP violation)
    - Use `chrome.scripting.executeScript` for content script injection (not manifest `content_scripts` for dynamic needs)
    - Testing approach: CDP on localhost:9222 for automated verification
    - Build system: Vite 5.x + React 18+ Tailwind CSS 3.x
    - React 18+ Hooks, isolated state management, see constitution.md, Principles IV, V)
    - **Performance**: Page load detection within 5s, content extraction within notification
    - **MV3 CSP Compliance**: No `eval()`, no `new Function()`, no remote CDNs. all assets bundled locally. see constitution.md, Principles II and V
    - **Local Build Pipeline**: Vite 5.x + React 18+ Tailwind CSS 3.x. Build output to `dist/` directory

    - **Testing**: CDP on localhost:9222 + Vitest
    - **Target Platform**: Chrome Browser Extension (MV3)
    - **Project Type**: Chrome Extension (popup UI + service worker)
    **Performance Goals**: < 5s response time, < 30s per page load
    - **Constraints**: < 10kb max content size, content truncation at 10kb, no eval/new Function
    - **Scale/Scope**: Single popup, small extension

## Project Structure
*Documentation (this feature)
```text
specs/004-webview-content-retrieval/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
src/
├── popup/
│   ├── Canvas/
│   ├── Chat/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   │   ├── contentExtractor.ts    # New service
│   │   ├── toolRegistry.ts        # Modified
│   │   └── dagExecutor.ts
│   └── workers/
├── background/
│   └── index.ts
├── content/
│   └── scraper.ts
├── shared/
│   ├── types.ts
│   ├── storage.ts
│   ├── messages.ts
│   └── dagSchema.ts
├── sandbox/
│   └── executor.ts
└── tests/
    └── (test files)
```

**Structure Decision**: Chrome Extension (popup + background service worker) with existing MV3-compliant sandbox. Uses background proxy for web fetching, existing `execute_dag` with `web-operation` nodes. New `read_webpage_content` tool will extend this pattern.

- Content extraction via `DagFetch` in background + readability.js
- Content notification to `ToolResponse` callback pattern
- Metadata enrichment (URL, title, size, timestamp)

## Complexity Tracking
No violations - all principles followed, required patterns, no additional complexity needed.
