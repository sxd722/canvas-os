import type { LLMCallParams } from '../../shared/dagSchema';
import type { LLMConfig } from '../../shared/types';

interface LLMCallMessage {
  type: 'execute';
  nodeId: string;
  params: LLMCallParams;
  config?: LLMConfig;
}

interface LLMCallResult {
  nodeId: string;
  success: boolean;
  result?: {
    response: string;
    model: string;
    tokens?: number;
  };
  error?: string;
}

const ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
};

self.onmessage = async (event: MessageEvent) => {
  const message = event.data as LLMCallMessage;
  const { nodeId, params, config } = message;
  
  if (!config) {
    const result: LLMCallResult = {
      nodeId,
      success: false,
      error: 'No LLM configuration provided'
    };
    self.postMessage(result);
    return;
  }
  
  try {
    const endpoint = config.endpoint || ENDPOINTS[config.provider];
    
    if (!endpoint) {
      const result: LLMCallResult = {
        nodeId,
        success: false,
        error: 'No endpoint configured for provider'
      };
      self.postMessage(result);
      return;
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    let body: object;
    const model = params.model || config.model;
    
    if (config.provider === 'anthropic') {
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      
      body = {
        model: model,
        max_tokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7,
        messages: [{ role: 'user', content: params.prompt }]
      };
    } else {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      
      body = {
        model: model,
        max_tokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7,
        messages: [{ role: 'user', content: params.prompt }]
      };
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const result: LLMCallResult = {
        nodeId,
        success: false,
        error: errorData.error?.message || `API error: ${response.status}`
      };
      self.postMessage(result);
      return;
    }
    
    const data = await response.json();
    
    let content: string;
    let tokens: number | undefined;
    
    if (config.provider === 'anthropic') {
      content = data.content?.[0]?.text || '';
      tokens = data.usage?.output_tokens;
    } else {
      content = data.choices?.[0]?.message?.content || '';
      tokens = data.usage?.total_tokens;
    }
    
    const result: LLMCallResult = {
      nodeId,
      success: true,
      result: {
        response: content,
        model: model,
        tokens
      }
    };
    self.postMessage(result);
  } catch (error) {
    const result: LLMCallResult = {
      nodeId,
      success: false,
      error: error instanceof Error ? error.message : 'LLM call failed'
    };
    self.postMessage(result);
  }
};

export {};
