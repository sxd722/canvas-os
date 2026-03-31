# Implementation Plan: DAG Scrape and LLM Calc Node Support

**Branch**: `008-dag-scrape-llm-calc` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-dag-scrape-llm-calc/spec.md`

## Summary

Add routing support for `scrape` and `llm_calc` node types in the DAG execution engine's `executeNodeWithWorker` method. The `scrape` node delegates to the existing `SCRAPE_TAB` background script handler via `chrome.runtime.sendMessage`. The `llm_calc` node interpolates dependency results into a prompt template and calls the LLM provider via the existing `createLLMProvider` factory. All supporting infrastructure (background handler, LLM provider, type definitions, interpolation utility) already exists.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022)
**Primary Dependencies**: React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3
**Storage**: chrome.storage.local (LLM config), chrome.storage.session (ephemeral DAG state)
**Testing**: Vitest (unit), Chrome DevTools Protocol / CDP (integration)
**Target Platform**: Chrome Browser Extension (MV3)
**Project Type**: chrome-extension
**Performance Goals**: Scrape nodes must complete within configurable timeout (default 30s). LLM calc nodes bounded by LLM API latency.
**Constraints**: MV3 CSP — no eval, no remote CDNs, no dynamic code execution. All code bundled locally.
**Scale/Scope**: Up to 4 concurrent DAG nodes. Single file change (`toolRegistry.ts`) + one new import.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MV3 CSP Compliance | ✅ PASS | Uses `chrome.runtime.sendMessage` (existing pattern), no eval/Function. LLM calls go through bundled provider module, not external CDN. |
| II. Local Build Pipeline | ✅ PASS | Only adds TypeScript code to existing source tree. No new dependencies needed — `createLLMProvider` already imported from `src/shared/llm-provider.ts`. |
| III. Remote Debugging Verification | ✅ PASS | Console.log tracing already added (commit `8219e65`). New node types will include `[DAG]` prefixed logs matching existing pattern. |
| IV. Component Architecture | ✅ PASS | Change is within existing `ToolRegistry` class. No new components. |
| V. Extension API Isolation | ✅ PASS | `chrome.runtime.sendMessage` to background script follows existing message passing pattern (`DAG_FETCH`, `CONTENT_FETCH`). `chrome.tabs` usage is in background script only (not popup). |

**Gate Result**: ALL PASS — no violations, no justifications needed.

## Project Structure

### Documentation (this feature)

```text
specs/008-dag-scrape-llm-calc/
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
│   └── services/
│       └── toolRegistry.ts     # MODIFIED: Add scrape + llm_calc routing in executeNodeWithWorker
├── shared/
│   ├── dagSchema.ts            # EXISTING: ScrapeParams, LLMCalcParams types (no change needed)
│   └── llm-provider.ts         # EXISTING: createLLMProvider, LLMProvider.complete (no change needed)
├── background/
│   └── index.ts                # EXISTING: SCRAPE_TAB handler (no change needed)
└── tests/
    └── unit/
        └── content-extraction.test.ts  # EXISTING: Unit tests (no change needed)
```

**Structure Decision**: Single-file modification. No new files, no new directories. The `scrape` and `llm_calc` types, background handler, and LLM provider are all pre-existing — only the routing dispatch in `executeNodeWithWorker` is missing.

## Complexity Tracking

> No violations — table not applicable.
