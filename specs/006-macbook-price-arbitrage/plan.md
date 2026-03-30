# Implementation Plan: MacBook Price Arbitrage DAG

**Branch**: `006-macbook-price-arbitrage` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-macbook-price-arbitrage/spec.md`

## Summary

Implement the MacBook Price Arbitrage hero feature — an end-to-end demo where the LLM generates a 5-node parallel DAG (4 concurrent scrape nodes + 1 aggregation node) to compare MacBook Pro prices between Canada and China. The implementation introduces two major architectural additions: (1) an `LLMProvider` abstraction layer with a `DevAgentProvider` (localhost:8000 OpenAI-compatible) and `ProdAPIProvider` (direct cloud API calls), and (2) an extended DAG schema with `scrape` and `llm_calc` node types that use `chrome.tabs.create({active: false})` for DOM scraping and aggregate results into the LLM context window.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022)
**Primary Dependencies**: React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3
**Storage**: chrome.storage.local (LLM config), chrome.storage.session (ephemeral DAG state)
**Testing**: Vitest (unit), Chrome DevTools Protocol on localhost:9222 (integration)
**Target Platform**: Chrome 86+ with MV3 extension APIs
**Project Type**: Chrome Extension (desktop-app)
**Performance Goals**: Full DAG execution (5 nodes) under 60 seconds; 4 scrape nodes execute concurrently within parallelism limit of 4
**Constraints**: MV3 CSP compliance (no eval, no remote CDNs); service worker has no DOM access; tab scraping must use chrome.scripting.executeScript
**Scale/Scope**: Single extension popup with canvas-based DAG visualization; hero demo for 1 specific use case (MacBook Pro CA vs CN)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MV3 CSP Compliance | ✅ PASS | No eval/new Function. Scraping uses chrome.scripting.executeScript in background. LLM calls use fetch() to external endpoints (already compliant). DevAgentProvider calls localhost — no CSP issue (fetch is CSP-exempt for API calls). |
| II. Local Build Pipeline | ✅ PASS | All new code (LLMProvider, DAG schema extensions) is TypeScript source bundled via Vite. No runtime imports from external URLs. |
| III. Remote Debugging Verification | ✅ PASS | DAG execution is testable via CDP on port 9222. Existing ToolTester pattern can be extended. |
| IV. Component Architecture | ✅ PASS | LLMProvider follows interface pattern (not class components). New scrape/llm_calc types are pure TypeScript interfaces. useDagEngine remains a functional hook. |
| V. Extension API Isolation | ✅ PASS | chrome.tabs.create/remove for scraping runs in background service worker (correct context). chrome.scripting for DOM extraction (correct API). chrome.runtime.sendMessage for cross-context messaging (existing pattern). |

**Post-Phase 1 Re-check**: Will verify new interfaces don't leak implementation details into extension pages.

## Project Structure

### Documentation (this feature)

```text
specs/006-macbook-price-arbitrage/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── llm-provider.md  # LLMProvider interface contract
│   └── dag-execution.md # DAG execution contract
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── types.ts                  # Existing — add LLMProviderRequest/Response types
│   ├── dagSchema.ts              # Existing — extend with scrape/llm_calc types
│   └── llm-provider.ts           # NEW — LLMProvider interface + DevAgentProvider + ProdAPIProvider
├── popup/
│   ├── hooks/
│   │   ├── useDagEngine.ts       # Existing — extend for scrape/llm_calc node types
│   │   └── useLLMProvider.ts     # NEW — React hook wrapping LLMProvider
│   ├── services/
│   │   ├── toolRegistry.ts       # Existing — register scrape/llm_calc handlers
│   │   └── scrapeEngine.ts       # NEW — chrome.tabs-based DOM scraping logic
│   ├── Canvas/
│   │   └── DAGNode.tsx           # Existing — add scrape/llm_calc type labels
│   └── workers/
│       └── llmCallWorker.ts      # Existing — refactor to use LLMProvider abstraction
├── background/
│   └── index.ts                  # Existing — add SCRAPE_TAB message handler
└── tests/
    ├── llm-provider.test.ts      # NEW — unit tests for LLMProvider implementations
    └── dag-scrape.test.ts        # NEW — unit tests for scrape node execution
```

**Structure Decision**: Single Chrome Extension project. New files are added alongside existing ones following the established `shared/`, `popup/services/`, `popup/hooks/`, `popup/workers/` pattern. No new directories beyond what's listed. The LLMProvider abstraction lives in `shared/` because it's used by both popup (toolRegistry) and workers (llmCallWorker).

## Complexity Tracking

No constitution violations. No additional complexity justification needed.
