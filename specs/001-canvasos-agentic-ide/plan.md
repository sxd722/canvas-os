# Implementation Plan: CanvasOS Agentic IDE

**Branch**: `001-canvasos-agentic-ide` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-canvasos-agentic-ide/spec.md`

## Summary

CanvasOS is a Chrome Extension that acts as an Agentic IDE with a 30/70 split UI (Chat/Canvas). The architecture uses 4 layers: Orchestrator (React popup), Proxy (Service Worker), Hands (Content Script), and Safe Room (Sandboxed iframe). All code is bundled locally via Vite to comply with MV3 CSP restrictions.

## Technical Context

**Language/Version**: TypeScript 5.x / JavaScript ES2022
**Primary Dependencies**: React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3 APIs
**Storage**: chrome.storage.local (extension data), chrome.storage.session (temporary state)
**Testing**: Chrome DevTools Protocol (CDP) on localhost:9222, Vitest for unit tests
**Target Platform**: Chrome Browser Extension (Chrome 86+, Manifest V3)
**Project Type**: Chrome Extension (popup UI + service worker + content scripts + sandboxed iframe)
**Performance Goals**: <2s popup load, <5s chat response, smooth 60fps canvas panning
**Constraints**: MV3 CSP (no remote CDNs, no inline scripts, no eval in extension pages)
**Scale/Scope**: Single-user extension, 100+ canvas nodes, concurrent chat sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. MV3 CSP Compliance | ✅ PASS | sandbox.html uses `sandbox="allow-scripts"` for isolated eval(); all other code bundled locally via Vite |
| II. Local Build Pipeline | ✅ PASS | Vite + React + Tailwind configured in vite.config.js for single local bundle |
| III. Remote Debugging Verification | ✅ PASS | CDP testing on localhost:9222 planned |
| IV. Component Architecture | ✅ PASS | Functional React components with hooks, isolated in src/popup/, src/shared/ |
| V. Extension API Isolation | ✅ PASS | Service worker (background.js), content script (scraper.js), message passing via chrome.runtime |

**Exception Justification**: sandbox.html uses `eval()` which is prohibited by Principle I. However, this is the **intended exception** in MV3 - sandboxed iframes with `sandbox="allow-scripts"` are the approved mechanism for executing dynamic code. The sandbox is isolated from extension APIs and cannot access user data directly.

## Project Structure

### Documentation (this feature)

```text
specs/001-canvasos-agentic-ide/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── messages.md      # postMessage contracts
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
public/
├── sandbox.html         # Sandboxed iframe for safe JS execution (bypasses React)
└── manifest.json        # Extension manifest (copied to dist/)

src/
├── popup/               # Orchestrator layer (main UI)
│   ├── App.tsx          # Root component with 30/70 split
│   ├── Chat/            # Chat panel components
│   │   ├── ChatPanel.tsx
│   │   ├── ChatInput.tsx
│   │   └── ChatMessage.tsx
│   ├── Canvas/          # Canvas panel components
│   │   ├── CanvasPanel.tsx
│   │   ├── CanvasNode.tsx
│   │   └── InfiniteCanvas.tsx
│   └── main.tsx         # Entry point
├── background/          # Proxy layer (service worker)
│   └── index.ts         # Service worker with lifecycle handlers
├── content/             # Hands layer (content scripts)
│   └── scraper.ts       # DOM extraction script
├── sandbox/             # Safe Room layer (sandboxed iframe logic)
│   └── executor.ts      # Code execution logic (loaded by sandbox.html)
├── shared/              # Shared utilities and types
│   ├── types.ts         # TypeScript interfaces
│   ├── messages.ts      # Message type definitions
│   └── storage.ts       # chrome.storage helpers
└── styles/
    └── index.css        # Tailwind imports

tests/
├── unit/                # Vitest unit tests
├── integration/         # CDP integration tests
└── e2e/                 # Full extension tests

dist/                    # Build output (load unpacked from here)
├── index.html           # Popup entry
├── sandbox.html         # Copied from public/
├── assets/              # Bundled JS/CSS
└── manifest.json
```

**Structure Decision**: Chrome Extension structure with 4 architectural layers. The `public/sandbox.html` is placed outside `src/` to bypass Vite's React compilation while still being copied to `dist/`.

## Complexity Tracking

> No constitution violations requiring justification. Sandbox eval() is an approved MV3 pattern.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| eval() in sandbox | LLM-generated code execution requires dynamic evaluation | No alternative exists for safe dynamic code execution in MV3; sandboxed iframe is the prescribed solution |
