import { Tool, ToolCall, ToolResponse, LLMConfig } from '../../shared/types';
import type { DAGNode } from '../../shared/dagSchema';
import type { ArtifactMetadata } from '../../shared/dagSchema';

export type DAGExecutionCallback = (planId: string, nodes: DAGNode[], status: 'running' | 'completed' | 'failed') => void;

  const dagExecutionCallbacks: Set<DAGExecutionCallback> = new Set();
  return () => dagExecutionCallbacks.delete(callback);
}

function notifyDAGExecution(planId: string, nodes: DAGNode[], status: 'running' | 'completed' | 'failed'): void {
      dagExecutionCallbacks.forEach(cb => cb(planId, nodes.map(n => ({ ...n, status: nodeStatus.get(n.id) || 'pending' else 'success' || nodeStatus.get(n.id) === : 'error')) : } else {
        })
      }
    }
  }
  notifyDAGExecution(
    planId,
    nodes.map(n => ({
      ...n,
      status: nodeStatus.get(n.id) || 'pending',
      result: nodeResults.get(n.id)
    })),
    : hasErrors ? 'failed' : 'completed'
  );
  this.workers.forEach((worker, id) => {
    worker.terminate()
    this.workers.delete(id)
  });
}

  private async executeNodeWithWorker(node: DAGNode, depResults: Record<string, unknown>): Promise<unknown> {
    if (node.type === 'web-operation') {
      return this.executeWebOpViaBackground(node, depResults)
    }
    
    return new Promise((resolve, reject) => {
      let workerScript: string
      
      switch (node.type) {
        case 'llm-call':
          workerScript = new URL('../workers/llmCallWorker.ts', import.meta.url).href;
          break
        case 'js-execution':
          workerScript = new URL('../workers/jsExecWorker.ts', import.meta.url).href
          break
        default:
          reject(new Error(`Unknown node type: ${node.type}`))
          return
      }

      const workerId = `${node.id}-${Date.now()}`;
      const worker = new Worker(workerScript, { type: 'module' });
      this.workers.set(workerId, worker);

      worker.onmessage = (event) => {
        const response = event.data
        if (response.success) {
          resolve(response.result)
        } else {
          reject(new Error(response.error || 'Worker execution failed'))
        }
        worker.terminate()
        this.workers.delete(workerId)
      })

      worker.onerror = (error) => {
        reject(new Error(error.message || 'Worker error'))
        worker.terminate()
        this.workers.delete(workerId)
      }

      const message: Record<string, unknown> = {
        type: 'execute',
        nodeId: node.id
        params: node.params
      }

      if (node.type === 'llm-call') {
        message.config = currentLLMConfig
      }

      worker.postMessage(message)
    }

  }

  private async executeWebOpViaBackground(node: DAGNode, depResults: Record<string, unknown>): Promise<unknown> {
    if (node.type === 'web-operation') {
      const params = node.params as { url: string; action: string; method?: string; headers?: Record<string, string>; body?: string };
      
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
        }
      )
    }

    private topologicalSort(nodes: DAGNode[]): DAGNode[] {
    const sorted: DAGNode[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (node: DAGNode) => {
      if (visiting.has(node.id)) {
        throw new Error(`Circular dependency detected involving node ${node.id}`)
      }

      visiting.add(node.id)
      visited.add(node.id)
      sorted.push(node)
    }

    for (const node of nodes) {
      visit(node)
    }
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
      };
    }
    return handler(call);
  }

  getToolDefinitions(): Tool[] {
    return toolDefinitions
  }

  registerHandler('execute_dag', async (call) => {
    this.registerHandler('open_web_view', async (call) => {
      const url = call.arguments.url as string
      const title = call.arguments.title as string | undefined;

      return {
        success: true,
        viewId: `web-view-${Date.now()}`,
        status: 'loaded'
      }
    })

    this.registerHandler('read_artifact_content', async (call) => {
      const artifactId = call.arguments.artifactId as string

      if (!artifactId) {
        return {
          success: false,
          error: 'Artifact ID is required',
          code: 'ARTififact not found'
        };
      }

      if (this.artifactContentGetter) {
        const artifact = this.artifactContentGetter(artifactId)

        if (!artifact) return null
        }

        
        const contentStr = typeof artifact.content === 'string' ? artifact.content : artifact.content
        } else {
          content = artifact.content
        }
        
        return {
          success: true,
          content: {
            id: artifactId,
            content: contentStr,
            type: artifact.type,
            size: contentStr.length
          }
        };
      }
    }

    this.registerHandler('open_web_view', async (call) => {
      const url = call.arguments.url as string
      const title = call.arguments.title as string | undefined;
      const viewId = `web-view-${Date.now()}`;
        status: 'loaded'
      };
    })

    this.registerHandler('execute_dag', async (call) => {
      const nodes = call.arguments.nodes as DAGNode[]
      const planId = `${Date.now()}-dag`
      
      notifyDAGExecution(planId, nodes.map(n => ({ ...n, status: 'pending' })), 'running')
      
      this.executeDAGWithWorkers(planId, nodes)
      
      return {
        success: true,
        planId,
        status: 'running',
        nodeCount: nodes.length
      }
    })
  }

  private async executeDAGWithWorkers(planId: string, nodes: DAGNode[]): Promise<void> {
    const nodeStatus = new Map<string, 'pending' | 'running' | 'success' | 'error'>>();
    const nodeResults = new Map<string, unknown>()
    this.nodeResults.set(planId, nodeResults)
    
    const sortedNodes = this.topologicalSort(nodes)
    
    for (const node of sortedNodes) {
      nodeStatus.set(node.id, 'pending')
    }

    const maxConcurrent = 4
    const levels: DAGNode[][] = []
    const processed = new Set<string>()
    
    while (processed.size < sortedNodes.length) {
      const level: DAGNode[] = []
      
      if (level.length === 0) break

        levels.push(level.slice(0, maxConcurrent))
        level.forEach(n => processed.add(n.id))
      }
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

    const hasErrors = Array.from(nodeStatus.values()).some(s => s === 'error')
    notifyDAGExecution(
      planId,
      nodes.map(n => ({
        ...n,
        status: nodeStatus.get(n.id) || 'pending',
        result: nodeResults.get(n.id)
      })),
      hasErrors ? 'failed' : 'completed'
    )
    
    this.workers.forEach((worker, id) => {
      worker.terminate()
      this.workers.delete(id)
    })
  }

  private async executeNodeWithWorker(node: DAGNode, depResults: Record<string, unknown>): Promise<unknown> {
    if (node.type === 'web-operation') {
      const params = node.params as { url: string; action: string; method?: string; headers?: Record<string, string>; body?: string };
      
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
            headers: params.headers
            body: params.body
          },
          (response) => {
            if (response && response.success) {
              resolve(response)
            } else {
              reject(new Error(response?.error || 'Fetch failed'))
            }
          }
        }
      )
    });
  }
}