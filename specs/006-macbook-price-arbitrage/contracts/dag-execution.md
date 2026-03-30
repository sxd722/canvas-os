# Contract: DAG Execution — scrape and llm_calc Node Types

**Feature**: 006-macbook-price-arbitrage
**Files**: `src/shared/dagSchema.ts`, `src/popup/services/toolRegistry.ts`, `src/background/index.ts`
**Stability**: Internal (used within extension)

## New Node Type: scrape

### Schema

```typescript
interface ScrapeParams {
  type: 'scrape';
  url: string;           // REQUIRED — URL to scrape
  selector?: string;     // OPTIONAL — CSS selector (default: 'body')
  waitMs?: number;       // OPTIONAL — JS render wait (default: 3000ms)
  timeout?: number;      // OPTIONAL — overall timeout (default: 30000ms)
}
```

### Execution Contract

**Invoker**: `toolRegistry.executeNodeWithWorker()` when `node.type === 'scrape'`

**Flow**:
```
toolRegistry (popup)
  → chrome.runtime.sendMessage({ type: 'SCRAPE_TAB', url, selector, waitMs, timeout })
  → background/index.ts handleScrapeTab()
    → chrome.tabs.create({ url, active: false })
    → wait waitMs for JS rendering
    → chrome.scripting.executeScript({ target: { tabId }, func: extractContent, args: [selector] })
    → chrome.tabs.remove(tabId)
    → return { success, content, title, extractedAt, durationMs }
  ← result stored in nodeResults map
```

**Message Protocol** (popup → background):

```typescript
// Request
{ type: 'SCRAPE_TAB', url: string, selector?: string, waitMs?: number, timeout?: number }

// Response (success)
{
  success: true,
  content: string,       // extracted text from DOM
  title?: string,        // document.title
  extractedAt: number,   // Date.now()
  durationMs: number     // total time from tab create to content extracted
}

// Response (error)
{
  success: false,
  error: string          // human-readable error message
}
```

**Contract guarantees**:
- Tab is ALWAYS cleaned up (`chrome.tabs.remove`) — even on error
- If tab creation fails: return error immediately, no cleanup needed
- If scripting injection fails: close tab, return error
- If timeout expires: close tab, return timeout error
- Content length is capped at 50,000 characters to prevent excessive memory usage

### Background Handler (src/background/index.ts)

```typescript
async function handleScrapeTab(
  url: string,
  selector?: string,
  waitMs?: number,
  timeout?: number
): Promise<ScrapeResult> {
  // 1. chrome.tabs.create({ url, active: false })
  // 2. setTimeout(waitMs) for JS rendering
  // 3. chrome.scripting.executeScript with DOM extraction function
  // 4. chrome.tabs.remove(tabId)
  // 5. Return ScrapeResult
}
```

### toolRegistry Handler

```typescript
// In executeNodeWithWorker(), add new branch:
if (node.type === 'scrape') {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'SCRAPE_TAB', ...node.params },
      (response) => {
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Scrape failed'));
        }
      }
    );
  });
}
```

---

## New Node Type: llm_calc

### Schema

```typescript
interface LLMCalcParams {
  type: 'llm_calc';
  prompt: string;       // REQUIRED — prompt template with $nodeId placeholders
  model?: string;       // OPTIONAL — model override
}
```

### Execution Contract

**Invoker**: `toolRegistry.executeNodeWithWorker()` when `node.type === 'llm_calc'`

**Flow**:
```
toolRegistry (popup)
  → interpolateCodeWithDeps(prompt, depResults)
    → Replace $nodeId with JSON.stringify(depResults[nodeId])
  → Format aggregated context:
      [Data from {nodeId}]: {interpolated result}
      [Data from {nodeId}]: {interpolated result}
      ...
      Task: {remaining prompt text after interpolation}
  → LLMProvider.complete([{ role: 'user', content: aggregatedPrompt }])
  → Store CompletionResult in nodeResults
```

**Dependency interpolation contract**:
- `$nodeId` in the prompt is replaced with the stringified result of the referenced node
- If a dependency node has `status: 'error'`, the llm_calc node is SKIPPED (not executed)
- If a dependency node has no result (undefined), `$nodeId` is replaced with `"[No data available]"`

**Pre-execution validation**:
- `dependsOn` must not be empty — if empty, skip with error "llm_calc requires at least one dependency"
- All dependencies must have `status: 'success'` — if any has error/skipped, this node is skipped

### toolRegistry Handler

```typescript
// In executeNodeWithWorker(), add new branch:
if (node.type === 'llm_calc') {
  const params = node.params as LLMCalcParams;

  // Validate dependencies
  if (node.dependencies.length === 0) {
    throw new Error('llm_calc requires at least one dependency');
  }

  // Check all deps succeeded
  for (const depId of node.dependencies) {
    const depStatus = nodeStatusMap.get(depId);
    if (depStatus !== 'success') {
      throw new Error(`Dependency ${depId} not completed successfully (status: ${depStatus})`);
    }
  }

  // Interpolate and aggregate
  const interpolatedPrompt = interpolateCodeWithDeps(params.prompt, depResults);
  const aggregatedPrompt = formatAggregatedPrompt(interpolatedPrompt, node.dependencies, depResults);

  // Call LLM
  const provider = createLLMProvider(currentLLMConfig!);
  const result = await provider.complete(
    [{ role: 'user', content: aggregatedPrompt }],
    { model: params.model }
  );

  if (!result.success) {
    throw new Error(result.error || 'LLM calculation failed');
  }

  return {
    success: true,
    response: result.content,
    model: result.model,
    tokens: result.tokens,
    aggregatedFrom: node.dependencies
  };
}
```

---

## DAG JSON Schema Extension

The `DAG_JSON_SCHEMA` in `dagSchema.ts` must be updated:

```typescript
type: {
  type: 'string',
  enum: ['llm-call', 'js-execution', 'web-operation', 'scrape', 'llm_calc']
}
```

## toolRegistry execute_dag Tool Definition

The `toolDefinitions` entry for `execute_dag` must be updated to document the new node types:

```typescript
items: {
  type: 'object',
  required: ['id', 'type', 'params', 'dependencies'],
  properties: {
    type: {
      type: 'string',
      enum: ['llm-call', 'js-execution', 'web-operation', 'scrape', 'llm_calc'],
      description: 'Node type: scrape for DOM extraction, llm_calc for LLM aggregation, ...'
    }
  }
}
```
