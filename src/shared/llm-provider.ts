import type { LLMConfig } from './types';

// --- Types ---

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  success: boolean;
  content?: string;
  model: string;
  tokens?: { prompt: number; completion: number };
  error?: string;
}

export interface LLMProvider {
  readonly name: string;
  complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;
}

// --- DevAgentProvider (localhost:8000 OpenAI-compatible) ---

const PROD_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
};

export class DevAgentProvider implements LLMProvider {
  readonly name = 'DevAgent (localhost)';

  constructor(
    private baseUrl: string = 'http://localhost:8000/v1',
    private apiKey?: string
  ) {}

  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    const model = options?.model || 'default';
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      const body = {
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: options?.maxTokens || 2048,
        temperature: options?.temperature || 0.7,
      };
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: (errorData as Record<string, unknown>).error
            ? String((errorData as Record<string, Record<string, string>>).error?.message || `HTTP ${response.status}`)
            : `HTTP ${response.status}`,
          model,
        };
      }
      const data = await response.json() as Record<string, unknown>;
      const choices = data.choices as Array<Record<string, Record<string, string>>> | undefined;
      return {
        success: true,
        content: choices?.[0]?.message?.content || '',
        model,
        tokens: data.usage
          ? {
              prompt: Number((data.usage as Record<string, number>).prompt_tokens || 0),
              completion: Number((data.usage as Record<string, number>).completion_tokens || 0),
            }
          : undefined,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'DevAgent request failed', model };
    }
  }
}

// --- ProdAPIProvider (wraps existing openai/anthropic/glm/custom) ---

export class ProdAPIProvider implements LLMProvider {
  readonly name: string;

  constructor(private config: LLMConfig) {
    this.name = `ProdAPI (${config.provider})`;
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    const model = options?.model || this.config.model;
    try {
      const endpoint = this.config.endpoint || PROD_ENDPOINTS[this.config.provider];
      if (!endpoint) {
        return { success: false, error: `No endpoint for provider: ${this.config.provider}`, model };
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: Record<string, unknown>;

      if (this.config.provider === 'anthropic') {
        headers['x-api-key'] = this.config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
        body = {
          model,
          max_tokens: options?.maxTokens || this.config.maxTokens || 2048,
          temperature: options?.temperature || this.config.temperature || 0.7,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        };
      } else {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        body = {
          model,
          max_tokens: options?.maxTokens || this.config.maxTokens || 2048,
          temperature: options?.temperature || this.config.temperature || 0.7,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        };
      }

      const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: (errorData as Record<string, unknown>).error
            ? String((errorData as Record<string, Record<string, string>>).error?.message || `HTTP ${response.status}`)
            : `HTTP ${response.status}`,
          model,
        };
      }

      const data = await response.json() as Record<string, unknown>;
      let content: string;
      let tokens: { prompt: number; completion: number } | undefined;

      if (this.config.provider === 'anthropic') {
        const contentArr = data.content as Array<Record<string, string>> | undefined;
        content = contentArr?.[0]?.text || '';
        const usage = data.usage as Record<string, number> | undefined;
        tokens = usage
          ? { prompt: Number(usage.input_tokens || 0), completion: Number(usage.output_tokens || 0) }
          : undefined;
      } else {
        const choices = data.choices as Array<Record<string, Record<string, string>>> | undefined;
        content = choices?.[0]?.message?.content || '';
        const usage = data.usage as Record<string, number> | undefined;
        tokens = usage
          ? { prompt: Number(usage.prompt_tokens || 0), completion: Number(usage.completion_tokens || 0) }
          : undefined;
      }

      return { success: true, content, model, tokens };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'ProdAPI request failed', model };
    }
  }
}

// --- Factory ---

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
