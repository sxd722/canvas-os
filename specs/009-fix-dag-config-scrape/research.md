# Research: Fix DAG Config Initialization and Scrape-to-Webview Routing

**Feature**: 009-fix-dag-config-scrape
**Date**: 2026-03-31

## Research Tasks

### R1: setLLMConfig Availability and Signature

**Decision**: Use existing `setLLMConfig` public method on `ToolRegistry` class.

**Findings**: The `ToolRegistry` class in `toolRegistry.ts` exports `setLLMConfig` as a public method. It sets the module-level `currentLLMConfig` variable used by `llm_calc` nodes and the `browse_webview` handler. The function signature accepts an `LLMConfig` object (provider, apiKey, model, endpoint, etc.).

**Rationale**: The method already exists — just needs to be called at the right lifecycle points. No new code needed for the function itself.

---

### R2: App.tsx loadData and handleSaveConfig Locations

**Decision**: Add `setLLMConfig(savedConfig)` after `getLLMConfig()` resolves in `loadData`, and `setLLMConfig(newConfig)` in `handleSaveConfig`.

**Findings**:
- `loadData` (App.tsx:47-60): Async function that loads `savedConfig` from `getLLMConfig()`. Currently calls `setConfig(savedConfig)` (React state) but does NOT call `toolRegistry.setLLMConfig()`.
- `handleSaveConfig` needs to be located — the config save handler.

**Rationale**: The React state `config` is used for UI rendering. The tool registry's `currentLLMConfig` is used for DAG execution. Both must be kept in sync.

---

### R3: browse_webview Tool Call from Within executeNodeWithWorker

**Decision**: Call `this.executeTool({ name: 'browse_webview', arguments: { url, intent, title } })` from the scrape node routing.

**Findings**: The `executeTool` method on `ToolRegistry` dispatches to registered tool handlers. The `browse_webview` handler:
1. Creates a webview session
2. Creates a DAG plan (browse → interact → extract)
3. Sends `OPEN_URL` postMessage to the iframe
4. Waits for extraction via `waitForExtraction()`
5. Returns `{ success, elements, content, sessionId, ... }`

**Key consideration**: When called from `executeNodeWithWorker`, the `browse_webview` handler runs directly without the `handleToolCall` wrapper in `App.tsx` that creates canvas nodes and waits for iframe rendering. However, the `browse_webview` handler itself creates canvas nodes internally via `setCanvasNodes` (passed via `setWebviewSessionAccessor`), so the iframe rendering is handled.

**Rationale**: The `browse_webview` tool is self-contained — it manages its own canvas node creation, iframe messaging, and extraction. Calling it from within the DAG engine works because all the necessary accessors (canvas node setter, webview session manager) are already wired up in `App.tsx` via `useEffect`.

---

### R4: Scrape Node Result Shape from browse_webview

**Decision**: Return the full `browse_webview` result as the scrape node output.

**Findings**: The `browse_webview` handler returns:
```typescript
{ success: true, sessionId: string, content: string, elements: Array<...>, title: string, ... }
```

The `content` field contains the extracted page text. The `elements` field contains scored elements. For downstream `llm_calc` nodes that use `$nodeId` interpolation, `JSON.stringify(result)` will include all fields. The `llm_calc` prompt template can reference the full result or specific fields.

**Rationale**: Returning the full result gives downstream nodes maximum flexibility. The `llm_calc` prompt can reference the scraped data via `$scrapeNodeId` and the LLM can extract what it needs.

---

## Summary

No NEEDS CLARIFICATION items. Two targeted changes:
1. **App.tsx**: Two `setLLMConfig()` calls (loadData + handleSaveConfig)
2. **toolRegistry.ts**: Replace `chrome.runtime.sendMessage({ type: 'SCRAPE_TAB' })` block with `this.executeTool({ name: 'browse_webview', ... })`
