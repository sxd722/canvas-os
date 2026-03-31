# Research: DAG Scrape and LLM Calc Node Support

**Feature**: 008-dag-scrape-llm-calc
**Date**: 2026-03-31

## Research Tasks

### R1: SCRAPE_TAB Background Handler Contract

**Decision**: Use existing `chrome.runtime.sendMessage({ type: 'SCRAPE_TAB', ... })` pattern.

**Findings**: The background script (`src/background/index.ts` lines 28-33, 140-206) already implements a complete `SCRAPE_TAB` handler:
- **Input**: `{ type: 'SCRAPE_TAB', url: string, selector?: string, waitMs?: number, timeout?: number }`
- **Success response**: `{ success: true, content: string, title?: string, extractedAt: number, durationMs: number }`
- **Error response**: `{ success: false, error: string }`
- **Content cap**: 50,000 characters (`SCRAPE_CONTENT_CAP`)
- **Tab lifecycle**: Creates background tab → waits → injects script → extracts text → removes tab
- **CSS selector**: Optional — when provided, only extracts from matched element

**Rationale**: The handler is fully implemented and tested. No changes needed. The `executeNodeWithWorker` method just needs to wrap this in a Promise.

**Alternatives considered**: Direct `chrome.tabs.create` + `chrome.scripting.executeScript` from popup — rejected because popup cannot use `chrome.tabs` API (requires `tabs` permission which is not in manifest for popup context). Background script message passing is the correct MV3 pattern.

---

### R2: LLM Provider Integration for llm_calc Nodes

**Decision**: Import `createLLMProvider` from `../../shared/llm-provider` and use `provider.complete()`.

**Findings**: The LLM provider module (`src/shared/llm-provider.ts`) provides:
- **Factory**: `createLLMProvider(config: LLMConfig): LLMProvider` — returns `DevAgentProvider` for localhost endpoints, `ProdAPIProvider` for production APIs
- **Interface**: `LLMProvider.complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult>`
- **Message type**: `{ role: 'system' | 'user' | 'assistant', content: string }`
- **Options**: `{ model?: string, maxTokens?: number, temperature?: number }`
- **Result**: `{ success: boolean, content?: string, model: string, tokens?: { prompt: number, completion: number }, error?: string }`
- **Config access**: `currentLLMConfig` is a module-level variable in `toolRegistry.ts`, set via `setLLMConfig()`

**Rationale**: Reuses the same provider factory used by `llmService` in `App.tsx`. The `llm_calc` node needs a direct LLM call (not through the agentic chat loop), so calling `provider.complete()` directly is the right approach.

**Alternatives considered**: Reusing `llmService.sendMessage()` — rejected because it's designed for chat conversations with tool definitions and response parsing. The `llm_calc` node needs a simple completion call with dependency-interpolated content.

---

### R3: Dependency Interpolation for llm_calc Prompts

**Decision**: Reuse existing `interpolateCodeWithDeps(code: string, deps: Record<string, unknown>): string` method.

**Findings**: The method (defined in `ToolRegistry` class) replaces `$nodeId` placeholders with `JSON.stringify(depResult)`. Currently used only by `js-execution` nodes. Works identically for prompt strings.

**Rationale**: Zero new code needed for interpolation. The same `$depNodeId` → `JSON.stringify(result)` replacement works for both JS code and LLM prompts.

**Alternatives considered**: Template literal interpolation — rejected because it would introduce a new pattern inconsistent with existing code.

---

### R4: Existing Node Type Routing Pattern

**Decision**: Follow the existing `if (node.type === '...')` dispatch pattern in `executeNodeWithWorker`.

**Findings**: Current routing (lines 765-818 of `toolRegistry.ts`):
1. `web-operation` → `executeWebOpViaBackground()` (via `chrome.runtime.sendMessage`)
2. `js-execution` → `executeInSandbox()` (via iframe postMessage)
3. `llm-call` → Web Worker with `llmCallWorker.ts`
4. `webview-browse/interact/extract` → `executeWebviewDAGNode()`
5. Fallback: `throw new Error('Unknown node type')`

Both `scrape` and `llm_calc` should be added before the fallback throw, following the same pattern.

**Rationale**: Consistent with existing code structure. Each node type is a self-contained if-block with logging.

---

## Summary

No NEEDS CLARIFICATION items remain. All infrastructure exists. Implementation requires:
1. One new import: `createLLMProvider` from `../../shared/llm-provider`
2. Two new if-blocks in `executeNodeWithWorker` before the "Unknown node type" throw
3. Console.log tracing consistent with existing `[DAG]` prefix pattern
