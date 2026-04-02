# Implementation Plan: Universal Semantic Lookup Tool

**Branch**: `013-semantic-lookup-tool` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-semantic-lookup-tool/spec.md`

## Summary

Transform the webview browsing agent from a universal semantic information lookup tool by removing hardcoded price-extraction logic. The system will pair text content with structural context to create semantic chunks, rank them by cosine similarity to user intent, and return a hybrid payload with information chunks and interactive elements.

## Technical Context

**Language/Version**: JavaScript ES2022 (webview_bridge.js), TypeScript 5.x (semanticExtractor.ts)
**Primary Dependencies**: Chrome Extensions MV3, Transformers.js (existing)
**Storage**: N/A (in-memory processing only)
**Testing**: Vitest + Chrome DevTools Protocol (CDP)
**Target Platform**: Chrome Extension (content script + popup service)
**Project Type**: Chrome Extension enhancement
**Performance Goals**: Extraction completes within 100ms for typical web pages
**Constraints**: Must work within iframe postMessage communication, CSP-compliant, Transformers.js embedding model must loaded
**Scale/Scope**: 2 files modified (~100 lines changed)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MV3 CSP Compliance | ✅ PASS | No external CDNs, all code bundled locally |
| II. Local Build Pipeline | ✅ PASS | Vite + TypeScript build, output to dist/ |
| III. Remote Debugging Verification | ✅ PASS | CDP testing on localhost:9222 |
| IV. Component Architecture | ✅ PASS | Modifying existing services, no new components |
| V. Extension API Isolation | ✅ PASS | Content script uses postMessage, no chrome APIs |

**Gate Status**: ✅ ALL PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/013-semantic-lookup-tool/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── extraction-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── content/
│   └── webview_bridge.js      # Semantic chunk extraction
└── popup/
    └── services/
        └── semanticExtractor.ts  # Scoring logic (already exists)

tests/
├── unit/
│   ├── webview-bridge.test.js
│   └── semanticExtractor.test.ts
└── integration/
    └── semantic-lookup.test.ts
```

**Structure Decision**: Minimal changes to existing structure. Two files modified: `src/content/webview_bridge.js` and `src/popup/services/semanticExtractor.ts`. Tests added in existing test directories.

## Complexity Tracking

> No violations - all constitution gates pass.
