import type { LLMCallParams } from '../../shared/dagSchema';
import type { LLMConfig } from '../../shared/types';
import { createLLMProvider } from '../../shared/llm-provider';

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

  const provider = createLLMProvider(config);
  const completionResult = await provider.complete(
    [{ role: 'user', content: params.prompt }],
    {
      model: params.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    }
  );

  const result: LLMCallResult = {
    nodeId,
    success: completionResult.success,
    error: completionResult.error,
  };

  if (completionResult.success && completionResult.content !== undefined) {
    result.result = {
      response: completionResult.content,
      model: completionResult.model,
      tokens: completionResult.tokens
        ? completionResult.tokens.prompt + completionResult.tokens.completion
        : undefined,
    };
  }

  self.postMessage(result);
};

export {};
