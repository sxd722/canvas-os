import type { LLMConfig, Tool } from '../../shared/types';

interface LLMResponse {
  content: string;
  code?: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

interface DebugFunctions {
  addLog: (entry: { type: 'llm-request' | 'tool-call' | 'dag-execution'; status: 'pending' | 'success' | 'error'; request: unknown }) => string;
  updateLog: (id: string, updates: { status?: 'pending' | 'success' | 'error'; error?: string; response?: unknown; duration?: number }) => void;
}

const ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
};

const CODE_PATTERN = /```(?:javascript|js)?\s*([\s\S]*?)```/g;

export const llmService = {
  async sendMessage(
    message: string,
    config: LLMConfig,
    tools?: Tool[],
    debug?: DebugFunctions
  ): Promise<LLMResponse> {
    const endpoint = config.endpoint || ENDPOINTS[config.provider];
    
    if (!endpoint) {
      throw new Error('No endpoint configured for provider');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    let body: Record<string, unknown>

    if (config.provider === 'anthropic') {
      headers['x-api-key'] = config.apiKey
      headers['anthropic-version'] = '2023-06-01'
      headers['anthropic-dangerous-direct-browser-access'] = 'true'
      
      body = {
        model: config.model,
        max_tokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7,
        messages: [{ role: 'user', content: message }],
        ...(tools && tools.length > 0 && {
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters
          }))
        })
      }
    } else {
      headers['Authorization'] = `Bearer ${config.apiKey}`
      
      body = {
        model: config.model,
        max_tokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7,
        messages: [{ role: 'user', content: message }],
        ...(tools && tools.length > 0 && {
          tools: tools.map(tool => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }
          }))
        })
      }
    }

    const logId = debug?.addLog({
      type: 'llm-request',
      status: 'pending',
      request: {
        endpoint,
        provider: config.provider,
        model: config.model,
        message,
        tools: tools?.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        })),
        timestamp: Date.now()
      }
    });

    const startTime = Date.now()

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || `API error: ${res.status}`
        if (logId) debug?.updateLog(logId, {
          status: 'error',
          error: errorMessage,
          response: errorData
        })
        throw new Error(errorMessage)
      }

      const data = await res.json()
      
      let content = ''
      let toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> | undefined

      if (config.provider === 'anthropic') {
        const textBlock = data.content?.find((b: { type: string }) => b.type === 'text') as { type: string; text: string } | undefined
        content = textBlock?.text || ''
        if (data.stop_reason === 'tool_use') {
          toolCalls = data.content
            ?.filter((b: { type: string }) => b.type === 'tool_use')
            .map((tc: { name: string; input: Record<string, unknown> }) => ({
              name: tc.name,
              arguments: tc.input
            }))
        }
      } else {
        const message = data.choices?.[0]?.message
        content = message?.content || ''
        if (message && message.tool_calls) {
          toolCalls = message.tool_calls.map((tc: { function: { name: string; arguments: string } }) => ({
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
        }
      }

      const codeMatches = content.matchAll(CODE_PATTERN)
      const codes = Array.from(codeMatches, (m) => m[1].trim())

      if (logId) debug?.updateLog(logId, {
        status: 'success',
        duration: Date.now() - startTime,
        response: data
      })

      return {
        content: content.replace(CODE_PATTERN, '').trim(),
        code: codes.length > 0 ? codes.join('\n\n') : undefined,
        toolCalls
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (logId) debug?.updateLog(logId, {
        status: 'error',
        error: errorMessage
      })
      throw error
    }
  }
}
