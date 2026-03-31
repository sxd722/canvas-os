# Data Model: Fix DAG Config Initialization and Scrape-to-Webview Routing

**Feature**: 009-fix-dag-config-scrape
**Date**: 2026-03-31

## Entities

### LLMConfig (existing — no changes)

| Field | Type | Description |
|-------|------|-------------|
| provider | `string` | LLM provider (openai, anthropic, glm, custom) |
| apiKey | `string` | API key |
| model | `string` | Default model |
| endpoint | `string` | API endpoint URL |
| maxTokens | `number` | Max tokens per request |
| temperature | `number` | Temperature |

**Defined in**: `src/shared/types.ts`
**Used by**: `currentLLMConfig` module variable in `toolRegistry.ts`, set via `setLLMConfig()`

### ScrapeParams (existing — no changes)

| Field | Type | Description |
|-------|------|-------------|
| type | `'scrape'` | Node type discriminator |
| url | `string` | URL to scrape |
| selector | `string` | Optional CSS selector |
| waitMs | `number` | Render wait time (now unused — webview manages its own timing) |
| timeout | `number` | Overall timeout (now unused — webview has 10s extraction timeout) |

**Defined in**: `src/shared/dagSchema.ts`

### browse_webview Tool Result (existing — no changes)

| Field | Type | Description |
|-------|------|-------------|
| success | `boolean` | Whether browse + extraction succeeded |
| content | `string` | Extracted page content |
| elements | `Array` | Scored page elements |
| sessionId | `string` | Webview session ID |
| title | `string` | Page title |
| error | `string` | Error message on failure |

**Defined in**: `browse_webview` handler return in `toolRegistry.ts`

## State Transitions

### currentLLMConfig Lifecycle

```
extension startup → loadData() → getLLMConfig() → setLLMConfig(savedConfig) → config available
                                                      ↓ (no saved config)
                                                   currentLLMConfig = undefined → llm_calc nodes fail

user saves config → handleSaveConfig(newConfig) → setLLMConfig(newConfig) → config updated
```

### Scrape Node Execution Flow (after fix)

```
pending → running → this.executeTool({ name: 'browse_webview', ... })
                         ↓
                   webview opens on canvas
                         ↓
                   extraction completes
                         ↓
                   running → success (result = browse_webview output)
                         ↓ (webview blocked/error)
                   running → error
```

## Data Flow

```
App.tsx loadData()
  → getLLMConfig() → savedConfig
  → setConfig(savedConfig)           [React state for UI]
  → toolRegistry.setLLMConfig(savedConfig)  [NEW: DAG execution]

App.tsx handleSaveConfig()
  → chrome.storage.local.set(...)
  → setConfig(newConfig)             [React state for UI]
  → toolRegistry.setLLMConfig(newConfig)    [NEW: DAG execution]

DAG engine executeNodeWithWorker()
  → node.type === 'scrape'
  → this.executeTool({ name: 'browse_webview', arguments: { url, intent, title } })
  → browse_webview handler creates webview + extracts content
  → result returned as scrape node output
  → downstream llm_calc nodes receive via $nodeId interpolation
```

## Validation Rules

- `setLLMConfig()` must be called with a valid `LLMConfig` object or `undefined` (to clear config)
- Scrape node result is the full `browse_webview` response — downstream nodes receive `JSON.stringify(result)` via interpolation
