# Implementation Plan: Fix DAG Config Initialization and Scrape-to-Webview Routing

**Branch**: `009-fix-dag-config-scrape` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-fix-dag-config-scrape/spec.md`

## Summary

Two bug fixes for the DAG execution engine: (1) Initialize the tool registry's `currentLLMConfig` from persisted storage on app startup and on settings save, so `llm_calc` nodes can instantiate the LLM provider. (2) Replace the `scrape` node's `SCRAPE_TAB` background message routing with a visual webview approach that calls `browse_webview` via `this.executeTool()`, displaying the target URL on the canvas.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022)
**Primary Dependencies**: React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3
**Storage**: chrome.storage.local (LLM config), chrome.storage.session (ephemeral DAG state)
**Testing**: Vitest (unit), Chrome DevTools Protocol / CDP (integration)
**Target Platform**: Chrome Browser Extension (MV3)
**Project Type**: chrome-extension
**Performance Goals**: Scrape nodes open webview iframes; bounded by page load time + extraction timeout (10s default).
**Constraints**: MV3 CSP — no eval, no remote CDNs. Iframe embedding subject to site-level X-Frame-Options restrictions (acknowledged, deferred).
**Scale/Scope**: Up to 4 concurrent DAG nodes. Two files modified (`App.tsx`, `toolRegistry.ts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MV3 CSP Compliance | ✅ PASS | No new scripts or external resources. `browse_webview` is an existing bundled tool. |
| II. Local Build Pipeline | ✅ PASS | Only TypeScript edits to existing files. No new dependencies. |
| III. Remote Debugging Verification | ✅ PASS | Console.log tracing already in place; new `[DAG]` logs for webview-based scraping. |
| IV. Component Architecture | ✅ PASS | Changes within existing `App.tsx` (config wiring) and `ToolRegistry` class (scrape routing). |
| V. Extension API Isolation | ✅ PASS | `setLLMConfig` is an existing public method on `ToolRegistry`. No new extension API usage. |

**Gate Result**: ALL PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-fix-dag-config-scrape/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── popup/
│   ├── App.tsx                       # MODIFIED: Add setLLMConfig calls in loadData + handleSaveConfig
│   └── services/
│       └── toolRegistry.ts           # MODIFIED: Replace scrape SCRAPE_TAB routing with browse_webview
├── shared/
│   ├── dagSchema.ts                  # EXISTING: ScrapeParams type (no change)
│   └── llm-provider.ts               # EXISTING: createLLMProvider (no change)
└── background/
    └── index.ts                      # EXISTING: SCRAPE_TAB handler (no longer called by scrape nodes, still exists for standalone use)
```

**Structure Decision**: Two files modified. No new files, no new directories, no new dependencies.

## Complexity Tracking

> No violations — table not applicable.
