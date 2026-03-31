# Quickstart: DAG Scrape and LLM Calc Node Support

**Feature**: 008-dag-scrape-llm-calc
**Branch**: `008-dag-scrape-llm-calc`

## What This Does

Enables the DAG execution engine to run two new node types:
- **`scrape`** — Opens a background browser tab, extracts page text, returns content for downstream nodes
- **`llm_calc`** — Sends an assembled prompt (with scraped data interpolated in) to the LLM for structured analysis

## Implementation Scope

**Single file change**: `src/popup/services/toolRegistry.ts`

1. Add import: `import { createLLMProvider } from '../../shared/llm-provider'`
2. Add `scrape` if-block in `executeNodeWithWorker` — wraps `chrome.runtime.sendMessage({ type: 'SCRAPE_TAB', ... })` in a Promise
3. Add `llm_calc` if-block in `executeNodeWithWorker` — validates config, interpolates prompt, calls `provider.complete()`
4. Add `[DAG]` console.log tracing for both node types

**No new files. No new dependencies. No changes to background script, types, or LLM provider.**

## Verification

```bash
npm run build    # Must pass with zero errors
npx tsc --noEmit # Must pass (pre-existing test file warnings acceptable)
```

**Manual test** (via Chrome DevTools on localhost:9222):
1. Configure LLM API key in Settings
2. Send a prompt like: "Compare MacBook prices from https://store.apple.com and https://www.amazon.com"
3. Observe Chrome DevTools console for `[DAG]` prefixed logs showing scrape node execution and llm_calc aggregation
4. Verify canvas displays scraped content nodes and the LLM analysis result

## Key Files

| File | Role |
|------|------|
| `src/popup/services/toolRegistry.ts` | **MODIFY** — Add scrape + llm_calc routing |
| `src/background/index.ts` | READ ONLY — SCRAPE_TAB handler (already exists) |
| `src/shared/llm-provider.ts` | READ ONLY — createLLMProvider factory (already exists) |
| `src/shared/dagSchema.ts` | READ ONLY — ScrapeParams, LLMCalcParams types (already exists) |
