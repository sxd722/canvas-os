import type { WebOperationParams } from '../../shared/dagSchema';

type WebOpMessage = {
  type: 'execute';
  nodeId: string;
  params: WebOperationParams;
  dependencyResults?: Record<string, unknown>;
};

type WebOpResponse = {
  type: 'result' | 'error';
  nodeId: string;
  result?: unknown;
  error?: string;
  executionTime?: number;
};

async function executeWebOperation(params: WebOperationParams): Promise<unknown> {
  const { url, action } = params;

  if (action === 'fetch') {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/html, text/plain, */*'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        data: null,
        status: response.status,
        url
      };
    }

    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      success: true,
      data,
      status: response.status,
      contentType,
      url
    };
  }

  if (action === 'screenshot') {
    return {
      success: false,
      error: 'Screenshot action requires browser context and cannot be performed in a web worker',
      data: null
    };
  }

  return {
    success: false,
    error: `Unknown web operation action: ${action}`,
    data: null
  };
}

self.onmessage = async (event: MessageEvent<WebOpMessage>) => {
  const { nodeId, params, dependencyResults } = event.data;
  const startTime = performance.now();

  try {
    if (params.url.includes('$')) {
      let resolvedUrl = params.url;
      if (dependencyResults) {
        for (const [depId, depResult] of Object.entries(dependencyResults)) {
          const result = depResult as { data?: unknown };
          if (result && result.data) {
            resolvedUrl = resolvedUrl.replace(
              new RegExp(`\\$${depId}`, 'g'),
              JSON.stringify(result.data)
            );
          }
        }
      }
      params.url = resolvedUrl;
    }

    const result = await executeWebOperation(params);
    const executionTime = performance.now() - startTime;

    const response: WebOpResponse = {
      type: 'result',
      nodeId,
      result,
      executionTime
    };

    self.postMessage(response);
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const response: WebOpResponse = {
      type: 'error',
      nodeId,
      error: error instanceof Error ? error.message : 'Web operation failed',
      executionTime
    };

    self.postMessage(response);
  }
};

export {};
