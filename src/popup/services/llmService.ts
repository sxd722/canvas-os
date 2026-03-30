import type { LLMConfig, Tool } from '../../shared/types';

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface LLMResponse {
  content: string;
  code?: string;
  toolCalls?: Array<{
    id?: string;
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
  /**
   * Send a conversation to the LLM.
   * Accepts either a single string (backward compatible) or an array of ConversationMessage.
   */
  async sendMessage(
    messageOrHistory: string | ConversationMessage[],
    config: LLMConfig,
    tools?: Tool[],
    debug?: DebugFunctions
  ): Promise<LLMResponse> {
    const endpoint = config.endpoint || ENDPOINTS[config.provider];
    
    if (!endpoint) {
      throw new Error('No endpoint configured for provider');
    }

    // Normalize input: string → single user message, array → conversation history
    const messages: ConversationMessage[] = typeof messageOrHistory === 'string'
      ? [{ role: 'user', content: messageOrHistory }]
      : messageOrHistory;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    let body: Record<string, unknown>

    if (config.provider === 'anthropic') {
      headers['x-api-key'] = config.apiKey
      headers['anthropic-version'] = '2023-06-01'
      headers['anthropic-dangerous-direct-browser-access'] = 'true'

      // Anthropic: filter out tool-role messages, extract system message
      const systemMsg = messages.find(m => m.role === 'system')?.content;
      const filteredMessages = messages
        .filter(m => m.role !== 'system' && m.role !== 'tool')
        .map(m => ({ role: m.role, content: m.content }));

      body = {
        model: config.model,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
        ...(systemMsg && { system: systemMsg }),
        messages: filteredMessages,
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
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
        messages: messages.map(m => {
          // Include tool_calls on assistant messages for OpenAI-compatible APIs
          if (m.role === 'assistant' && m.tool_calls) {
            return { role: m.role, content: m.content, tool_calls: m.tool_calls };
          }
          return { role: m.role, content: m.content, ...(m.name && { name: m.name }), ...(m.tool_call_id && { tool_call_id: m.tool_call_id }) };
        }),
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
        messageCount: messages.length,
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
        const errorMessage = (errorData as Record<string, { message?: string }>).error?.message || `API error: ${res.status}`
        if (logId) debug?.updateLog(logId, {
          status: 'error',
          error: errorMessage,
          response: errorData
        })
        throw new Error(errorMessage)
      }

      const data = await res.json()
      
      let content = ''
      let toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }> | undefined

      if (config.provider === 'anthropic') {
        const textBlock = (data.content as Array<{ type: string; text?: string }>)?.find((b) => b.type === 'text')
        content = textBlock?.text || ''
        if (data.stop_reason === 'tool_use') {
          toolCalls = (data.content as Array<{ type: string; name?: string; input?: Record<string, unknown>; id?: string }>)
            ?.filter((b) => b.type === 'tool_use')
            .map((tc) => ({
              id: tc.id,
              name: tc.name || '',
              arguments: tc.input || {}
            }))
        }
      } else {
        const responseMessage = (data.choices?.[0]?.message) as { content?: string; tool_calls?: Array<{ id?: string; function: { name: string; arguments: string } }> } | undefined
        content = responseMessage?.content || ''
        if (responseMessage?.tool_calls) {
          toolCalls = responseMessage.tool_calls.map((tc) => ({
            id: tc.id,
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
