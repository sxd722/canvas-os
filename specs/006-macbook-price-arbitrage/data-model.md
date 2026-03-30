# Data Model: MacBook Price Arbitrage DAG

**Feature**: 006-macbook-price-arbitrage
**Date**: 2026-03-27

## Overview

This document defines the TypeScript interfaces and entities introduced by the MacBook Price Arbitrage feature. All types extend the existing codebase patterns defined in `src/shared/dagSchema.ts` and `src/shared/types.ts`.

---

## New Interfaces

### 1. LLMProvider (src/shared/llm-provider.ts)

The core abstraction for LLM communication. All LLM calls in the extension route through this interface.

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface CompletionResult {
  success: boolean;
  content?: string;
  model: string;
  tokens?: { prompt: number; completion: number };
  error?: string;
}

interface LLMProvider {
  readonly name: string;
  complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;
}
```

### 2. DevAgentProvider (src/shared/llm-provider.ts)

Connects to a local OpenAI-compatible server (oh-my-openagent).

```typescript
interface DevAgentConfig {
  baseUrl: string;  // default: 'http://localhost:8000/v1'
  apiKey?: string;  // optional, some local servers don't require auth
  model: string;    // default: 'default'
}
```

**Behavior**: Always sends OpenAI-format requests to `{baseUrl}/chat/completions`. Parses `choices[0].message.content` from response.

### 3. ProdAPIProvider (src/shared/llm-provider.ts)

Wraps the existing 3-provider logic (openai, anthropic, glm).

```typescript
// Reuses existing LLMConfig from src/shared/types.ts:
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'glm' | 'custom';
  apiKey: string;
  endpoint?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}
```

**Behavior**: Routes to correct endpoint based on `config.provider`. Handles provider-specific auth headers and response parsing.

### 4. Provider Factory

```typescript
function createLLMProvider(config: LLMConfig): LLMProvider;
```

**Selection logic**: If `config.endpoint` starts with `http://localhost` or `http://127.0.0.1`, return `DevAgentProvider`. Otherwise return `ProdAPIProvider`.

---

## Extended DAG Schema

### 5. New Node Types (src/shared/dagSchema.ts — extension)

```typescript
// Extended union type
type DAGNodeType = 'llm-call' | 'js-execution' | 'web-operation' | 'scrape' | 'llm_calc';

// New params interfaces
interface ScrapeParams {
  type: 'scrape';
  url: string;
  selector?: string;    // CSS selector, defaults to 'body'
  waitMs?: number;      // ms to wait for JS rendering, defaults to 3000
  timeout?: number;     // overall timeout, defaults to 30000
}

interface LLMCalcParams {
  type: 'llm_calc';
  prompt: string;       // template with $nodeId placeholders
  model?: string;       // override model for this node
}

// Extended union
type DAGNodeParams = LLMCallParams | JSExecutionParams | WebOperationParams | ScrapeParams | LLMCalcParams;
```

### 6. ScrapeResult

```typescript
interface ScrapeResult {
  success: boolean;
  url: string;
  content: string;          // extracted text content
  title?: string;           // page title
  extractedAt: number;      // timestamp
  durationMs: number;       // how long the scrape took
  error?: string;
}
```

### 7. LLMCalcResult

```typescript
interface LLMCalcResult {
  success: boolean;
  response: string;         // LLM's comparison output
  model: string;
  tokens?: number;
  aggregatedFrom: string[]; // node IDs whose results were concatenated
  error?: string;
}
```

---

## Entity Relationships

```
DAGPlan
├── DAGNode (type: 'scrape') × 4  ──→  ScrapeResult
│   ├── dependsOn: []
│   └── params: { url, selector?, waitMs? }
│
└── DAGNode (type: 'llm_calc') × 1  ──→  LLMCalcResult
    ├── dependsOn: [node1, node2, node3, node4]
    └── params: { prompt with $nodeId refs }

LLMProvider (interface)
├── DevAgentProvider  ──→  localhost:8000/v1/chat/completions
└── ProdAPIProvider   ──→  openai / anthropic / glm endpoints

createLLMProvider(config) ──→  LLMProvider
```

---

## State Transitions

### DAGNode Status Lifecycle

```
pending → running → success
                   → error
                   → skipped (if dependency failed)
```

### Scrape Node Execution Flow

```
pending → running
  → chrome.tabs.create({active: false})
  → wait waitMs (JS rendering)
  → chrome.scripting.executeScript (DOM extraction)
  → chrome.tabs.remove (cleanup)
  → success (with ScrapeResult)
  OR
  → error (timeout, tab crash, script injection failure)
```

### LLMCalc Node Execution Flow

```
pending → running
  → interpolate $nodeId placeholders with predecessor results
  → format aggregated prompt
  → call LLMProvider.complete()
  → success (with LLMCalcResult)
  OR
  → skipped (if any predecessor has error status)
  → error (LLM API failure, context too long)
```

---

## Validation Rules

| Entity | Rule | Enforced By |
|--------|------|-------------|
| DAGNode (scrape) | `params.url` must be a valid URL string | TypeScript type + runtime check in handler |
| DAGNode (llm_calc) | `params.prompt` must contain at least one `$` reference | TypeScript type (prompt is required string) |
| DAGNode (llm_calc) | `dependsOn` must not be empty (needs predecessor data) | Runtime validation before execution |
| LLMProvider | `complete()` must return `CompletionResult` with `success` boolean | Interface contract |
| ScrapeResult | `content` must be a non-empty string on success | Handler validation |
| DevAgentProvider | `baseUrl` must end with `/v1` | Factory normalization |
