# Research: MacBook Price Arbitrage DAG

**Feature**: 006-macbook-price-arbitrage
**Date**: 2026-03-27

## Research Topics

### 1. LLMProvider Abstraction Strategy

**Decision**: Create a TypeScript `interface LLMProvider` with `complete(messages, config)` method. Implement `DevAgentProvider` (localhost:8000 OpenAI-compatible) and `ProdAPIProvider` (direct cloud API calls). Use a factory function `createLLMProvider(config)` that selects the appropriate provider.

**Rationale**:
- The existing `llmCallWorker.ts` has hardcoded provider logic (3 providers: openai, anthropic, glm) with different auth headers and response parsing per provider.
- A `DevAgentProvider` pointing at `http://localhost:8000/v1/chat/completions` enables local development with `oh-my-openagent` without needing real API keys.
- The abstraction allows future providers (Ollama, vLLM, etc.) to be added as new implementations without touching the worker.
- Factory pattern is simpler than dependency injection in a Chrome extension context (no DI container needed).

**Alternatives considered**:
- *Abstract class with inheritance*: Rejected — TypeScript interfaces with composition are more idiomatic and allow multiple provider mixins.
- *Single function with provider switch*: Rejected — existing code already does this and it's becoming unwieldy with 3+ providers.
- *Dynamic provider loading*: Rejected — MV3 CSP prevents runtime code loading.

**Implementation notes**:
- `LLMProvider` interface: `{ complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> }`
- `DevAgentProvider`: Always hits `http://localhost:8000/v1/chat/completions` with OpenAI-compatible format
- `ProdAPIProvider`: Wraps the existing 3-provider logic (openai, anthropic, glm) from `llmCallWorker.ts`
- Provider selection: When `config.endpoint` starts with `http://localhost` or `http://127.0.0.1`, use `DevAgentProvider`; otherwise use `ProdAPIProvider`
- Both providers must work in Web Worker context (no DOM access)

---

### 2. DAG Schema Extension: scrape and llm_calc Node Types

**Decision**: Extend `DAGNodeType` union with `'scrape' | 'llm_calc'`. Add corresponding params interfaces `ScrapeParams` and `LLMCalcParams` to `dagSchema.ts`.

**Rationale**:
- Current schema has 3 types: `llm-call`, `js-execution`, `web-operation`. None fit the scraping use case well:
  - `web-operation` fetches raw HTTP response via background proxy — no DOM parsing
  - `llm-call` calls LLM — no scraping
  - `js-execution` runs JS in sandbox — no DOM access (sandbox iframe, not real pages)
- `scrape` type: Opens a real Chrome tab, waits for page load, extracts DOM content via `chrome.scripting.executeScript`, closes the tab. This gets full DOM (including JS-rendered content that `fetch()` cannot access).
- `llm_calc` type: Takes aggregated results from scrape nodes, formats them into an LLM prompt, and calls the LLMProvider to produce a structured comparison result.

**Alternatives considered**:
- *Reuse `web-operation` for scraping*: Rejected — `web-operation` only fetches raw HTTP. Apple Store pages are heavily JS-rendered and need a real browser tab for accurate price extraction.
- *Add scraping capability to `js-execution`*: Rejected — `js-execution` runs in a sandboxed iframe, not in the context of a real web page.
- *Content script approach*: Rejected for dynamic pages — content scripts run on page load, but the user may want to scrape URLs that weren't pre-registered in the manifest.

**Node type definitions**:
```
ScrapeParams: { type: 'scrape'; url: string; selector?: string; waitMs?: number }
LLMCalcParams: { type: 'llm_calc'; prompt: string; model?: string }
```

---

### 3. Parallel Execution Strategy for scrape Nodes

**Decision**: Extend the existing level-based parallel execution in `toolRegistry.executeDAGWithWorkers()` to handle `scrape` nodes. Scrape nodes with `dependsOn: []` execute concurrently via `Promise.all()`, limited by the existing `maxConcurrent = 4` constraint.

**Rationale**:
- The existing engine already supports parallel execution via topological sort + level batching with `maxConcurrent = 4`.
- The MacBook Price Arbitrage DAG has exactly 4 independent scrape nodes — perfectly matching the concurrency limit.
- No changes needed to the parallel scheduling logic — only a new node type handler (`executeNodeWithWorker` branch for `scrape`).
- Scrape execution flows through the background service worker (which has tab permissions), not from the popup.

**Scrape execution flow**:
1. Popup's `toolRegistry` sends `{ type: 'SCRAPE_TAB', url, selector?, waitMs? }` to background via `chrome.runtime.sendMessage`
2. Background `handleScrapeTab()`:
   - `chrome.tabs.create({ url, active: false })` → get tab ID
   - Wait `waitMs` (default 3000ms) for page load + JS rendering
   - `chrome.scripting.executeScript({ target: { tabId }, func: extractDOM })` → get innerText
   - `chrome.tabs.remove(tabId)` → clean up
   - Return `{ success: true, content: string }` to popup
3. Popup stores result in `nodeResults` map, same as existing node types

**Alternatives considered**:
- *Run scraping from popup via chrome.tabs*: Rejected — while popup can call chrome.tabs API, keeping all tab management in the background service worker is cleaner and follows the existing pattern (see `handleResearchUrl`).
- *Keep tabs open for user inspection*: Rejected for the hero demo — tabs should be ephemeral. Future enhancement could add a "keep tab" option.

---

### 4. Result Aggregation for llm_calc Node

**Decision**: When the `llm_calc` node triggers, it receives all predecessor results via the existing dependency interpolation mechanism (`$nodeId` replacement). The `llm_calc` handler concatenates predecessor results into a structured prompt and calls the LLMProvider.

**Rationale**:
- The existing `interpolateCodeWithDeps()` method replaces `$nodeId` patterns with stringified results. For `llm_calc`, we extend this: instead of code, the "template" is a prompt string containing `$nodeId` placeholders.
- The `llm_calc` handler formats the aggregated data as a structured context block:
  ```
  [Data from Apple CA]: {result from scrape node 1}
  [Data from Apple CN]: {result from scrape node 2}
  [Exchange Rate]: {result from scrape node 3}
  [HST Rate]: {result from scrape node 4}
  
  Task: {prompt from llm_calc params}
  ```
- This structured format ensures the LLM receives all data in a single context window call.

**Implementation approach**:
- Add a new branch in `executeNodeWithWorker()` for `type === 'llm_calc'`
- Interpolate the prompt with predecessor results (reuse `interpolateCodeWithDeps` pattern)
- Call LLMProvider (same as existing `llm-call` but with the aggregated prompt)
- Store the LLM's response as the node result

**Alternatives considered**:
- *Separate aggregation step before LLM call*: Rejected — unnecessary complexity. The LLM can handle structured input directly.
- *Use js-execution for calculation instead of LLM*: Considered for the math (tax + currency conversion), but rejected because: (a) the spec requires a natural-language comparison output, (b) the LLM handles edge cases better (missing data, partial results), and (c) the hero demo value is in the LLM-generated narrative.

---

### 5. Canvas DAG Visualization Updates

**Decision**: Extend `DAGNode.tsx` to add type labels and status colors for `scrape` and `llm_calc` nodes. Add connection lines between dependent nodes on the canvas.

**Rationale**:
- The existing `DAGNodeComponent` already renders node status, dependencies, and results. Only the `typeLabels` mapping needs new entries.
- Connection lines between nodes are a nice-to-have for the hero demo but not required for P1. The existing dependency list text ("Deps: node1, node2") is sufficient.

**Changes needed**:
- `DAGNode.tsx`: Add `scrape: 'Scrape'` and `llm_calc: 'LLM Calc'` to `typeLabels`
- Optional: Add SVG lines connecting dependent nodes (P2 enhancement)

---

### 6. Existing Pattern: handleResearchUrl as scrape Template

**Decision**: The existing `handleResearchUrl()` in `background/index.ts` is the exact pattern to follow for the new `SCRAPE_TAB` handler. It already demonstrates:
- `chrome.tabs.create({ url, active: false })` for invisible tabs
- `chrome.scripting.executeScript()` for DOM extraction
- Timeout handling with `Promise.race()`
- Tab cleanup with `chrome.tabs.remove()`

**Rationale**:
- The code pattern is battle-tested and MV3-compliant.
- The new `handleScrapeTab()` will be a generalized version with configurable: URL, CSS selector (optional, defaults to `document.body.innerText`), wait time, and timeout.
- Returns raw content string to the popup for further processing by LLM.

---

## Decisions Summary

| # | Decision | Key Reason |
|---|----------|------------|
| 1 | LLMProvider interface + DevAgentProvider + ProdAPIProvider | Clean abstraction; enables local dev with oh-my-openagent |
| 2 | New `scrape` and `llm_calc` DAG node types | Existing types don't support DOM scraping or result aggregation |
| 3 | Extend existing level-based parallel execution | Already supports 4 concurrent nodes; no scheduler changes needed |
| 4 | Dependency interpolation for result aggregation | Reuses existing $nodeId mechanism; structured prompt format |
| 5 | Extend DAGNode.tsx with new type labels | Minimal UI change; existing pattern |
| 6 | Follow handleResearchUrl pattern for SCRAPE_TAB | Proven MV3-compliant tab scraping pattern |
