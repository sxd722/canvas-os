import type { DAGNode, LLMCallParams, JSExecutionParams, WebOperationParams } from '../../shared/dagSchema';
import type { LLMConfig } from '../../shared/types';

class DagExecutor {
  async executeNode(node: DAGNode, config?: LLMConfig): Promise<unknown> {
    switch (node.type) {
      case 'llm-call':
        return this.executeLLMCall(node.params as LLMCallParams, config);
      case 'js-execution':
        return this.executeJSExecution(node.params as JSExecutionParams);
      case 'web-operation':
        return this.executeWebOperation(node.params as WebOperationParams);
      default:
        throw new Error(`Unknown node type: ${(node as { type: string }).type}`);
    }
  }

  private async executeLLMCall(params: LLMCallParams, config?: LLMConfig): Promise<unknown> {
    if (!config) {
      return {
        success: false,
        error: 'No LLM configuration provided',
        response: 'LLM call skipped - no config'
      };
    }

    try {
      const response = await this.callLLM(params.prompt, params.model || config.model, config);
      return {
        success: true,
        response: response.content,
        model: params.model || config.model
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LLM call failed',
        response: null
      };
    }
  }

  private async callLLM(prompt: string, model: string, config: LLMConfig): Promise<{ content: string }> {
    const endpoints: Record<string, string> = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    };

    const endpoint = config.endpoint || endpoints[config.provider];
    if (!endpoint) {
      throw new Error('No endpoint configured for provider');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    let body: object;

    if (config.provider === 'anthropic') {
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      
      body = {
        model: model,
        max_tokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7,
        messages: [{ role: 'user', content: prompt }]
      };
    } else {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      
      body = {
        model: model,
        max_tokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7,
        messages: [{ role: 'user', content: prompt }]
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    
    let content: string;
    if (config.provider === 'anthropic') {
      content = data.content?.[0]?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }

    return { content };
  }

  private async executeJSExecution(params: JSExecutionParams): Promise<unknown> {
    const timeout = params.timeout || 5000;
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: 'Execution timeout',
          result: null
        });
      }, timeout);

      try {
        const sandbox = document.createElement('iframe');
        sandbox.sandbox.add('allow-scripts');
        sandbox.style.display = 'none';
        document.body.appendChild(sandbox);

        const result = ((sandbox.contentWindow as unknown) as { eval: (code: string) => unknown }).eval(params.code);
        
        clearTimeout(timeoutId);
        document.body.removeChild(sandbox);

        resolve({
          success: true,
          result: result,
          executionTime: 0
        });
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Execution failed',
          result: null
        });
      }
    });
  }

  private async executeWebOperation(params: WebOperationParams): Promise<unknown> {
    try {
      if (params.action === 'fetch') {
        const response = await fetch(params.url);
        
        if (!response.ok) {
          return {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            data: null
          };
        }

        const contentType = response.headers.get('content-type');
        let data: unknown;

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        return {
          success: true,
          data: data,
          status: response.status,
          url: params.url
        };
      } else if (params.action === 'screenshot') {
        return {
          success: false,
          error: 'Screenshot action not supported in extension context',
          data: null
        };
      } else {
        return {
          success: false,
          error: `Unknown web operation: ${params.action}`,
          data: null
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Web operation failed',
        data: null
      };
    }
  }

  validateDAG(nodes: DAGNode[]): { valid: boolean; error?: string } {
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const node of nodes) {
      for (const depId of node.dependencies) {
        if (!nodeIds.has(depId)) {
          return {
            valid: false,
            error: `Node ${node.id} depends on non-existent node ${depId}`
          };
        }
      }
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (hasCycle(depId)) return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (hasCycle(node.id)) {
        return {
          valid: false,
          error: 'Circular dependency detected in DAG'
        };
      }
    }

    return { valid: true };
  }
}

export const dagExecutor = new DagExecutor();
