# Data Model: DAG Scrape and LLM Calc Node Support

**Feature**: 008-dag-scrape-llm-calc
**Date**: 2026-03-31

## Entities

### ScrapeParams (existing — no changes)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| type | `'scrape'` | yes | — | Node type discriminator |
| url | `string` | yes | — | URL to scrape |
| selector | `string` | no | `undefined` | CSS selector for targeted extraction |
| waitMs | `number` | no | `3000` | Milliseconds to wait for page rendering |
| timeout | `number` | no | `30000` | Overall scrape timeout in milliseconds |

**Defined in**: `src/shared/dagSchema.ts` (lines 23-29)

### LLMCalcParams (existing — no changes)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| type | `'llm_calc'` | yes | — | Node type discriminator |
| prompt | `string` | yes | — | Prompt template with `$depNodeId` placeholders |
| model | `string` | no | config model | Override LLM model for this node |

**Defined in**: `src/shared/dagSchema.ts` (lines 31-35)

### SCRAPE_TAB Message (existing — no changes)

**Request** (popup → background):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | `'SCRAPE_TAB'` | yes | Message type discriminator |
| url | `string` | yes | URL to scrape |
| selector | `string` | no | CSS selector |
| waitMs | `number` | no | Render wait time |
| timeout | `number` | no | Overall timeout |

**Response** (background → popup):

| Field | Type | Description |
|-------|------|-------------|
| success | `boolean` | Whether scrape succeeded |
| content | `string` | Extracted page text (capped at 50,000 chars) |
| title | `string` | Page title |
| extractedAt | `number` | Extraction timestamp |
| durationMs | `number` | Total scrape duration |
| error | `string` | Error message (on failure) |

### LLM Provider Complete Call (existing — no changes)

**Input**:

| Field | Type | Description |
|-------|------|-------------|
| messages | `Message[]` | Array of `{ role, content }` messages |
| options.model | `string` | Optional model override |

**Output** (`CompletionResult`):

| Field | Type | Description |
|-------|------|-------------|
| success | `boolean` | Whether LLM call succeeded |
| content | `string` | LLM response text |
| model | `string` | Model used |
| tokens | `{ prompt, completion }` | Token usage |
| error | `string` | Error message (on failure) |

## State Transitions

### Scrape Node Lifecycle

```
pending → running → success  (content extracted, tab cleaned up)
pending → running → error    (network failure, timeout, invalid URL)
```

### LLM Calc Node Lifecycle

```
pending → running → success  (LLM returned content)
pending → running → error    (no LLM config, API error, rate limit)
```

### Dependency Flow

```
scrape-1 (success) ──┐
scrape-2 (success) ──┼──→ llm_calc-1 (receives both results via $nodeId interpolation)
scrape-3 (error)   ──┘
```

- `llm_calc` node waits for ALL dependencies to complete before executing
- If any dependency fails, the `llm_calc` node is skipped (existing DAG engine behavior in `executeDAGWithWorkers`)
- Failed dependency results are NOT passed to `llm_calc` — the node is simply not executed

## Validation Rules

- `scrape` node: `url` must be a valid URL string (validated by background script's `chrome.tabs.create`)
- `llm_calc` node: `prompt` must be a non-empty string; `currentLLMConfig` must be set
- `llm_calc` node: `$depNodeId` placeholders that don't match any dependency key are left as-is (existing `interpolateCodeWithDeps` behavior)
