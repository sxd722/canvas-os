import { Tool, ToolCall, ToolResponse, LLMConfig } from '../../shared/types';
import type { DAGNode } from '../../shared/dagSchema';

export type DAGExecutionCallback = (planId: string, nodes: DAGNode[], status: 'running' | 'completed' | 'failed') => void;

const dagExecutionCallbacks: Set<DAGExecutionCallback> = new Set();

function notifyDAGExecution(planId: string, nodes: DAGNode[], status: 'running' | 'completed' | 'failed'): void {
  dagExecutionCallbacks.forEach(cb => cb(planId, nodes, status));
}

export function registerDAGExecutionCallback(callback: DAGExecutionCallback): () => void {
  dagExecutionCallbacks.add(callback);
  return () => {
    dagExecutionCallbacks.delete(callback);
  };
}

export type ArtifactMetadata = {
  id: string;
  title: string;
  type: string;
  summary: string;
  size: number;
  createdAt: number;
}

export type ArtifactContentGetter = (id: string) => { content: unknown; type: string; size: number } | null;

export const toolDefinitions: Tool[] = [
  {
    name: 'list_artifacts',
    description: 'List all artifacts on the canvas with their IDs, titles, types, and summaries. Use this first to discover available artifacts before using read_artifact_content.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'read_artifact_content',
    description: 'Fetch the full content of a canvas artifact. Use this when you need to analyze or reference the complete content of a file, image OCR text, or other artifact.',
    parameters: {
      type: 'object',
      properties: {
        artifactId: {
          type: 'string',
          description: 'The ID of the artifact to fetch'
        }
      },
      required: ['artifactId']
    }
  },
  {
    name: 'open_web_view',
    description: 'Open a web URL as an embedded interactive view in the canvas. Useful for research, documentation reference, or displaying web content.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to open',
          format: 'uri'
        },
        title: {
          type: 'string',
          description: 'Optional custom title for the view'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'read_webpage_content',
    description: 'Fetch and extract content from a webpage URL. Use this to retrieve product information, summarize articles, or extract specific data points like prices, emails, and dates.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch content from',
          format: 'uri'
        },
        mode: {
          type: 'string',
          enum: ['full', 'readability', 'data-points'],
          description: 'Extraction mode: "full" for all text, "readability" for article extraction, "data-points" for structured data (prices, emails, dates)'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'execute_dag',
    description: 'Execute a plan of interconnected tasks as a DAG. Web operations bypass CORS. Independent nodes run concurrently. Prefer this for multi-step tasks like fetching URLs, processing data, and summarizing results.',
    parameters: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          description: 'Array of DAG nodes to execute',
          items: {
            type: 'object',
            required: ['id', 'type', 'params', 'dependencies'],
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for this node'
              },
              type: {
                type: 'string',
                enum: ['llm-call', 'js-execution', 'web-operation'],
                description: 'Type of execution for this node'
              },
              params: {
                type: 'object',
                description: 'Parameters: llm-call={prompt}, js-execution={code,timeout}, web-operation={url,action}'
              },
              dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'IDs of nodes that must complete before this one'
              }
            }
          }
        }
      },
      required: ['nodes']
    }
  }
];

let currentLLMConfig: LLMConfig | undefined;

export function setLLMConfig(config: LLMConfig): void {
  currentLLMConfig = config;
}

export function getLLMConfig(): LLMConfig | undefined {
  return currentLLMConfig;
}

export type ArtifactMetadataGetter = () => ArtifactMetadata[];

export class ToolRegistry {
  private handlers: Map<string, (call: ToolCall) => Promise<ToolResponse>> = new Map();
  private workers: Map<string, Worker> = new Map();
  private nodeResults: Map<string, Map<string, unknown>> = new Map();
  private artifactMetadataGetter: ArtifactMetadataGetter | null = null;
  private artifactContentGetter: ArtifactContentGetter | null = null;

  constructor() {
    this.registerDefaultHandlers();
  }

  setArtifactMetadataGetter(getter: ArtifactMetadataGetter): void {
    this.artifactMetadataGetter = getter;
  }

  setArtifactContentGetter(getter: ArtifactContentGetter): void {
    this.artifactContentGetter = getter;
  }

  private registerDefaultHandlers(): void {
    this.registerHandler('list_artifacts', async () => {
      if (!this.artifactMetadataGetter) {
        return {
          success: false,
          error: 'Artifact metadata getter not configured',
          code: 'NO_ARTIFACT_METADATA_GETTER'
        };
      }

      const metadata = this.artifactMetadataGetter();
      return {
        success: true,
        artifacts: metadata.map(artifact => ({
          id: artifact.id,
          title: artifact.title,
          type: artifact.type,
          summary: artifact.summary.substring(0, 100) + (artifact.summary.length > 100 ? '...' : ''),
          size: artifact.size
        }))
      };
    });

    this.registerHandler('read_artifact_content', async (call) => {
      const artifactId = call.arguments.artifactId as string;

      if (!artifactId) {
        return {
          success: false,
          error: 'Artifact ID is required',
          code: 'MISSING_ARTIFACT_ID'
        };
      }

      if (!this.artifactContentGetter) {
        return {
          success: false,
          error: 'Artifact content getter not configured',
          code: 'NO_ARTIFACT_GETTER'
        };
      }

      const artifact = this.artifactContentGetter(artifactId);

      if (!artifact) {
        return {
          success: false,
          error: `Artifact not found: ${artifactId}`,
          code: 'ARTIFACT_NOT_FOUND'
        };
      }

      const contentStr = typeof artifact.content === 'string'
        ? artifact.content
        : JSON.stringify(artifact.content, null, 2);

      return {
        success: true,
        content: {
          id: artifactId,
          content: contentStr,
          type: artifact.type,
          size: contentStr.length
        }
      };
    });

    this.registerHandler('open_web_view', async (call) => {
      const url = call.arguments.url as string;
      const title = call.arguments.title as string | undefined;

      return {
        success: true,
        viewId: `web-view-${Date.now()}`,
        url,
        title: title || new URL(url).hostname,
        status: 'loaded'
      };
    });

    this.registerHandler('read_webpage_content', async (call) => {
      const url = call.arguments.url as string;
      const mode = (call.arguments.mode as string) || 'full';
      const timeout = (call.arguments.timeout as number) || 30000;

      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'CONTENT_FETCH',
            url,
            mode,
            timeout
          },
          (response) => {
            if (response && response.success) {
              resolve({
                success: true,
                content: {
                  url,
                  mode,
                  text: response.content,
                  metadata: response.metadata,
                  dataPoints: response.dataPoints
                }
              });
            } else {
              resolve({
                success: false,
                error: response?.error || 'Failed to fetch webpage content'
              });
            }
          }
        );
      });
    });

    this.registerHandler('execute_dag', async (call) => {
      const nodes = call.arguments.nodes as DAGNode[];
      const planId = `${Date.now()}-dag`;

      notifyDAGExecution(planId, nodes.map(n => ({ ...n, status: 'pending' })), 'running');

      this.executeDAGWithWorkers(planId, nodes);

      return {
        success: true,
        content: {
          planId,
          status: 'running',
          nodeCount: nodes.length
        }
      };
    });
  }

  private async executeDAGWithWorkers(planId: string, nodes: DAGNode[]): Promise<void> {
    const nodeStatus = new Map<string, 'pending' | 'running' | 'success' | 'error'>();
    const nodeResults = new Map<string, unknown>();
    this.nodeResults.set(planId, nodeResults);

    const sortedNodes = this.topologicalSort(nodes);

    for (const node of sortedNodes) {
      nodeStatus.set(node.id, 'pending');
    }

    const maxConcurrent = 4;
    const levels: DAGNode[][] = [];
    const processed = new Set<string>();

    while (processed.size < sortedNodes.length) {
      const level: DAGNode[] = [];

      for (const node of sortedNodes) {
        if (processed.has(node.id)) continue;

        const allDepsProcessed = node.dependencies.every(depId => processed.has(depId));

        if (allDepsProcessed) {
          level.push(node);
        }
      }

      if (level.length === 0) break

      levels.push(level.slice(0, maxConcurrent))
      level.forEach(n => processed.add(n.id))
    }

    for (const level of levels) {
      await Promise.all(
        level.map(async (node) => {
          nodeStatus.set(node.id, 'running')

          try {
            const depResults: Record<string, unknown> = {}
            for (const depId of node.dependencies) {
              const result = nodeResults.get(depId)
              if (result !== undefined) {
                depResults[depId] = result
              }
            }

            const result = await this.executeNodeWithWorker(node, depResults)
            nodeResults.set(node.id, result)
            nodeStatus.set(node.id, 'success')
            this.nodeResults.get(planId)?.set(node.id, result)
          } catch (error) {
            nodeStatus.set(node.id, 'error')
            this.nodeResults.get(planId)?.set(node.id, { error: error instanceof Error ? error.message : 'Unknown error' })
          }
        })
      )
    }

    const hasErrors = Array.from(nodeStatus.values()).some(s => s === 'error');
    notifyDAGExecution(
      planId,
      nodes.map(n => ({
        ...n,
        status: nodeStatus.get(n.id) || 'pending',
        result: nodeResults.get(n.id)
      })),
      hasErrors ? 'failed' : 'completed'
    );

    this.workers.forEach((worker, id) => {
      worker.terminate()
      this.workers.delete(id)
    })
  }

  private async executeNodeWithWorker(node: DAGNode, depResults: Record<string, unknown>): Promise<unknown> {
    if (node.type === 'web-operation') {
      return this.executeWebOpViaBackground(node, depResults)
    }

    return new Promise((resolve, reject) => {
      let workerScript: string

      switch (node.type) {
        case 'llm-call':
          workerScript = new URL('../workers/llmCallWorker.ts', import.meta.url).href
          break
        case 'js-execution':
          workerScript = new URL('../workers/jsExecWorker.ts', import.meta.url).href
          break
        default:
          reject(new Error(`Unknown node type: ${node.type}`))
          return
      }

      const workerId = `${node.id}-${Date.now()}`
      const worker = new Worker(workerScript, { type: 'module' })
      this.workers.set(workerId, worker)

      worker.onmessage = (event) => {
        const response = event.data
        if (response.success) {
          resolve(response.result)
        } else {
          reject(new Error(response.error || 'Worker execution failed'))
        }
        worker.terminate()
        this.workers.delete(workerId)
      }

      worker.onerror = (error) => {
        reject(new Error(error.message || 'Worker error'))
        worker.terminate()
        this.workers.delete(workerId)
      }

      const message: Record<string, unknown> = {
        type: 'execute',
        nodeId: node.id,
        params: node.params
      }

      if (node.type === 'llm-call') {
        message.config = currentLLMConfig
      }

      worker.postMessage(message)
    })
  }

  private async executeWebOpViaBackground(node: DAGNode, depResults: Record<string, unknown>): Promise<unknown> {
    const params = node.params as { url: string; action: string; method?: string; headers?: Record<string, string>; body?: string }

    let resolvedUrl = params.url
    if (depResults && params.url.includes('$')) {
      for (const [depId, depResult] of Object.entries(depResults)) {
        const result = depResult as { data?: unknown }
        if (result && result.data !== undefined) {
          resolvedUrl = resolvedUrl.replace(
            new RegExp(`\\$${depId}`, 'g'),
            JSON.stringify(result.data)
          )
        }
      }
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'DAG_FETCH',
          url: resolvedUrl,
          method: params.method || 'GET',
          headers: params.headers,
          body: params.body
        },
        (response) => {
          if (response && response.success) {
            resolve(response)
          } else {
            reject(new Error(response?.error || 'Fetch failed'))
          }
        }
      )
    })
  }

  private topologicalSort(nodes: DAGNode[]): DAGNode[] {
    const sorted: DAGNode[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (node: DAGNode) => {
      if (visited.has(node.id)) return
      if (visiting.has(node.id)) {
        throw new Error(`Circular dependency detected involving node ${node.id}`)
      }

      visiting.add(node.id)

      for (const depId of node.dependencies) {
        const depNode = nodes.find(n => n.id === depId)
        if (depNode) {
          visit(depNode)
        }
      }

      visiting.delete(node.id)
      visited.add(node.id)
      sorted.push(node)
    }

    for (const node of nodes) {
      visit(node)
    }

    return sorted
  }

  registerHandler(name: string, handler: (call: ToolCall) => Promise<ToolResponse>): void {
    this.handlers.set(name, handler)
  }

  async executeTool(call: ToolCall): Promise<ToolResponse> {
    const handler = this.handlers.get(call.name)
    if (!handler) {
      return {
        success: false,
        error: `Unknown tool: ${call.name}`,
        code: 'UNKNOWN_TOOL'
      }
    }
    return handler(call)
  }

  getToolDefinitions(): Tool[] {
    return toolDefinitions
  }

  getNodeResults(planId: string): Map<string, unknown> | undefined {
    return this.nodeResults.get(planId)
  }
}

export const toolRegistry = new ToolRegistry();