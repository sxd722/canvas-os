# Contract: LLMProvider Interface

**Feature**: 006-macbook-price-arbitrage
**File**: `src/shared/llm-provider.ts`
**Stability**: Internal (used within extension, not a public API)

## Interface Definition

```typescript
/**
 * LLMProvider — abstraction layer for LLM API communication.
 *
 * Implementations must work in Web Worker context (no DOM access).
 * All methods must return structured results, never throw unhandled.
 */
export interface LLMProvider {
  /** Human-readable provider name for logging and UI display */
  readonly name: string;

  /**
   * Send a chat completion request to the LLM.
   *
   * @param messages - Array of chat messages (system, user, assistant)
   * @param options - Optional completion parameters (model, maxTokens, temperature)
   * @returns CompletionResult with success flag, content, and metadata
   *
   * Contract: MUST NOT throw. All errors must be returned in CompletionResult.error.
   */
  complete(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options?: { model?: string; maxTokens?: number; temperature?: number }
  ): Promise<CompletionResult>;
}

export interface CompletionResult {
  success: boolean;
  content?: string;
  model: string;
  tokens?: { prompt: number; completion: number };
  error?: string;
}
```

## Implementations

### DevAgentProvider

```typescript
export class DevAgentProvider implements LLMProvider {
  readonly name = 'DevAgent (localhost)';

  constructor(
    private baseUrl: string = 'http://localhost:8000/v1',
    private apiKey?: string
  ) {}

  async complete(messages, options): Promise<CompletionResult> {
    // Always OpenAI-compatible format
    // POST {baseUrl}/chat/completions
    // Headers: Content-Type: application/json, Authorization: Bearer {apiKey} (if provided)
    // Body: { model, messages, max_tokens, temperature }
    // Response: { choices: [{ message: { content } }], usage: { total_tokens } }
  }
}
```

**Contract**:
- Base URL MUST end with `/v1`
- If `apiKey` is undefined, no Authorization header is sent
- Response parsing follows OpenAI format: `choices[0].message.content`
- On network error or non-2xx response: return `{ success: false, error: string, model }`

### ProdAPIProvider

```typescript
export class ProdAPIProvider implements LLMProvider {
  readonly name: string;

  constructor(private config: LLMConfig) {}

  async complete(messages, options): Promise<CompletionResult> {
    // Routes based on config.provider:
    //   openai:    → https://api.openai.com/v1/chat/completions
    //   anthropic: → https://api.anthropic.com/v1/messages
    //   glm:       → https://open.bigmodel.cn/api/paas/v4/chat/completions
    //   custom:    → config.endpoint (required)
  }
}
```

**Contract**:
- Provider-specific auth headers: `Authorization: Bearer` (openai/glm/custom), `x-api-key` (anthropic)
- Provider-specific response parsing: `choices[0]` (openai/glm/custom), `content[0].text` (anthropic)
- `config.endpoint` overrides default endpoint for any provider
- On network error or non-2xx response: return `{ success: false, error: string, model }`

## Factory

```typescript
export function createLLMProvider(config: LLMConfig): LLMProvider {
  const endpoint = config.endpoint || '';
  if (endpoint.startsWith('http://localhost') || endpoint.startsWith('http://127.0.0.1')) {
    return new DevAgentProvider(
      endpoint.replace(/\/v1\/?$/, '') + '/v1',
      config.apiKey || undefined
    );
  }
  return new ProdAPIProvider(config);
}
```

## Consumer Contract

Any code calling `LLMProvider.complete()` MUST:
1. Check `result.success` before accessing `result.content`
2. Handle `result.error` gracefully (display to user, retry, or skip)
3. Not assume `result.content` is defined when `success` is false
4. Not pass messages with empty content strings

## Migration from llmCallWorker.ts

The existing `llmCallWorker.ts` will be refactored to use `LLMProvider`:

**Before**: Hardcoded provider logic with switch on `config.provider`
**After**: `const provider = createLLMProvider(config); const result = await provider.complete(messages, options);`

The worker's `self.onmessage` handler remains unchanged — only the internal fetch logic is replaced with the provider abstraction.
