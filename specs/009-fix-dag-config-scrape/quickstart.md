# Quickstart: Fix DAG Config Initialization and Scrape-to-Webview Routing

**Feature**: 009-fix-dag-config-scrape
**Branch**: `009-fix-dag-config-scrape`

## What This Does

1. **Fixes LLM config initialization** — `currentLLMConfig` in the tool registry is now set on app startup (from persisted storage) and on settings save, so `llm_calc` DAG nodes can instantiate the LLM provider.
2. **Routes scrape nodes to canvas webviews** — Scrape DAG nodes now open visible embedded webviews on the canvas instead of invisible background tabs.

## Implementation Scope

**Two file changes**:

### `src/popup/App.tsx`
1. Import `setLLMConfig` from `'./services/toolRegistry'`
2. In `loadData` (line ~53): Add `toolRegistry.setLLMConfig(savedConfig)` after `setConfig(savedConfig)`
3. In `handleSaveConfig`: Add `toolRegistry.setLLMConfig(newConfig)` after saving to storage

### `src/popup/services/toolRegistry.ts`
1. Replace the `scrape` node routing block (lines ~861-886) — remove the `chrome.runtime.sendMessage({ type: 'SCRAPE_TAB' })` Promise wrapper
2. Replace with: `const result = await this.executeTool({ name: 'browse_webview', arguments: { url: params.url, intent: 'extract page data for comparison', title: 'Scrape: ' + params.url } }); return result;`
3. Update console.log tracing to reflect webview-based execution

**No new files. No new dependencies.**

## Verification

```bash
npm run build    # Must pass with zero errors
npx tsc --noEmit # Must pass
```

**Manual test** (via Chrome DevTools on localhost:9222):
1. Configure LLM API key in Settings
2. Submit a prompt that generates an `llm_calc` node → verify it succeeds (no more "LLM configuration is required" error)
3. Submit a multi-URL comparison prompt → verify each URL opens as a webview on the canvas
4. Check `[DAG]` console logs for scrape node execution via webview

## Key Files

| File | Role |
|------|------|
| `src/popup/App.tsx` | **MODIFY** — Add setLLMConfig calls in loadData + handleSaveConfig |
| `src/popup/services/toolRegistry.ts` | **MODIFY** — Replace SCRAPE_TAB routing with browse_webview |
| `src/background/index.ts` | READ ONLY — SCRAPE_TAB handler still exists but no longer called by DAG engine |
| `src/shared/llm-provider.ts` | READ ONLY — createLLMProvider (used by llm_calc nodes) |
