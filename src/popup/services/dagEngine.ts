import type { DAGNode, BrowseDAGNodeParams } from '../../shared/dagSchema';
import type { LLMConfig } from '../../shared/types';
import { createLLMProvider } from '../../shared/llm-provider';

export type DAGExecutionCallback = (planId: string, nodes: DAGNode[], status: 'running' | 'completed' | 'failed') => void;

const dagExecutionCallbacks: Set<DAGExecutionCallback> = new Set();

function notifyDAGExecution(planId: string, nodes: DAGNode[], status: 'running' | 'completed' | 'failed'): void {
  const nodeStatuses = nodes.map(n => `${n.id}:${n.status}`).join(', ');
  console.log(`[DAG] notifyDAGExecution | planId=${planId} | status=${status} | nodes=[${nodeStatuses}]`);
  dagExecutionCallbacks.forEach(cb => cb(planId, nodes, status));
}

export function registerDAGExecutionCallback(callback: DAGExecutionCallback): () => void {
  dagExecutionCallbacks.add(callback);
  return () => {
    dagExecutionCallbacks.delete(callback);
  };
}

export interface DAGEngineOptions {
  executeTool: (call: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;
  addCanvasNode: ((node: any) => void) | null;
  updateCanvasNode: ((nodeId: string, updates: Record<string, unknown>) => void) | null;
  getLLMConfig: () => LLMConfig | undefined;
}

export class DAGEngine {
  private executeTool: DAGEngineOptions['executeTool'];
  private addCanvasNode: DAGEngineOptions['addCanvasNode'];
  private updateCanvasNode: DAGEngineOptions['updateCanvasNode'];
  private getLLMConfig: DAGEngineOptions['getLLMConfig'];

  private workers: Map<string, Worker> = new Map();
  private nodeResults: Map<string, Map<string, unknown>> = new Map();
  private activeWebviewDAGPlanId: string | null = null;
  private activeWebviewDAGNodes: DAGNode[] = [];

  constructor(options: DAGEngineOptions) {
    this.executeTool = options.executeTool;
    this.addCanvasNode = options.addCanvasNode;
    this.updateCanvasNode = options.updateCanvasNode;
    this.getLLMConfig = options.getLLMConfig;
  }

  async executeDAGWithWorkers(planId: string, nodes: DAGNode[]): Promise<void> {
    console.log(`[DAG] executeDAGWithWorkers | planId=${planId} | totalNodes=${nodes.length}`);
    const nodeStatus = new Map<string, 'pending' | 'running' | 'success' | 'error'>();
    const nodeResults = new Map<string, unknown>();
    this.nodeResults.set(planId, nodeResults);

    const sortedNodes = this.topologicalSort(nodes);
    console.log(`[DAG] topologicalSort | planId=${planId} | order=${sortedNodes.map(n => n.id).join(' → ')}`);

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

    console.log(`[DAG] level planning | planId=${planId} | levels=${levels.length} | perLevel=${levels.map(l => `[${l.map(n => `${n.id}(${n.type})`).join(',')}]`).join(' → ')}`);

    for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
      const level = levels[levelIdx];
      console.log(`[DAG] executing level ${levelIdx + 1}/${levels.length} | planId=${planId} | nodes=[${level.map(n => `${n.id}(${n.type})`).join(', ')}]`);

      await Promise.all(
        level.map(async (node) => {
          console.log(`[DAG] node starting | planId=${planId} | nodeId=${node.id} | type=${node.type} | deps=[${node.dependencies.join(',')}]`);
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
            console.log(`[DAG] node success | planId=${planId} | nodeId=${node.id} | type=${node.type} | resultType=${typeof result}`);
          } catch (error) {
            nodeStatus.set(node.id, 'error')
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            this.nodeResults.get(planId)?.set(node.id, { error: errMsg })
            console.error(`[DAG] node failed | planId=${planId} | nodeId=${node.id} | type=${node.type} | error=${errMsg}`);
          }
        })
      )

      console.log(`[DAG] level ${levelIdx + 1}/${levels.length} completed | planId=${planId}`);
    }

    const hasErrors = Array.from(nodeStatus.values()).some(s => s === 'error');
    const finalStatuses = Array.from(nodeStatus.entries()).map(([id, s]) => `${id}:${s}`).join(', ');
    console.log(`[DAG] all levels completed | planId=${planId} | hasErrors=${hasErrors} | finalStatuses=[${finalStatuses}]`);
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

  async executeNodeWithWorker(node: DAGNode, depResults: Record<string, unknown>): Promise<unknown> {
    console.log(`[DAG] executeNodeWithWorker | nodeId=${node.id} | type=${node.type} | depKeys=${Object.keys(depResults).join(',')}`);

    if (node.type === 'web-operation') {
      console.log(`[DAG] node web-operation | nodeId=${node.id} | dispatching to executeWebOpViaBackground`);
      return this.executeWebOpViaBackground(node, depResults)
    }

    if (node.type === 'js-execution') {
      const params = node.params as { code: string; timeout?: number }
      const codeWithDeps = this.interpolateCodeWithDeps(params.code, depResults)
      console.log(`[DAG] node js-execution | nodeId=${node.id} | timeout=${params.timeout || 5000}`);
      return this.executeInSandbox(codeWithDeps, params.timeout || 5000)
    }

    if (node.type === 'llm-call') {
      console.log(`[DAG] node llm-call | nodeId=${node.id} | spawning Web Worker`);
      return new Promise((resolve, reject) => {
        const workerScript = new URL('../workers/llmCallWorker.ts', import.meta.url).href
        const workerId = `${node.id}-${Date.now()}`
        const worker = new Worker(workerScript, { type: 'module' })
        this.workers.set(workerId, worker)

        worker.onmessage = (event) => {
          const response = event.data
          console.log(`[DAG] llm-call worker response | nodeId=${node.id} | success=${response.success}`);
          if (response.success) {
            resolve(response.result)
          } else {
            reject(new Error(response.error || 'Worker execution failed'))
          }
          worker.terminate()
          this.workers.delete(workerId)
        }

        worker.onerror = (error) => {
          console.error(`[DAG] llm-call worker error | nodeId=${node.id} | error=${error.message}`);
          reject(new Error(error.message || 'Worker error'))
          worker.terminate()
          this.workers.delete(workerId)
        }

        const currentLLMConfig = this.getLLMConfig();
        const message: Record<string, unknown> = {
          type: 'execute',
          nodeId: node.id,
          params: node.params,
          config: currentLLMConfig
        }

        worker.postMessage(message)
      })
    }

    if (node.type === 'webview-browse' || node.type === 'webview-interact' || node.type === 'webview-extract') {
      console.log(`[DAG] node webview | nodeId=${node.id} | type=${node.type} | dispatching to executeWebviewDAGNode`);
      return this.executeWebviewDAGNode(node);
    }

    if (node.type === 'scrape') {
      const params = node.params as { url: string; selector?: string; waitMs?: number; timeout?: number };
      console.log(`[DAG] node scrape | nodeId=${node.id} | url=${params.url} | intent=extract page data for comparison | title=Scrape: ${params.url}`);

      const canvasNodeId = `dag-node-${node.id}`;
      if (this.addCanvasNode) {
        this.addCanvasNode({
          id: canvasNodeId,
          type: 'web-view',
          content: { url: params.url, title: 'Scrape: ' + params.url, status: 'loading' },
          position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
          size: { width: 600, height: 400 },
          createdAt: Date.now(),
          source: 'dag-scrape'
        });
        console.log(`[DAG] node scrape | spawned canvas node | canvasNodeId=${canvasNodeId} | url=${params.url}`);
      } else {
        console.warn(`[DAG] node scrape | addCanvasNode not wired, skipping canvas node spawn`);
      }

      await new Promise(r => setTimeout(r, 100));

      const result = await this.executeTool({
        name: 'browse_webview',
        arguments: {
          url: params.url,
          intent: 'extract page data for comparison',
          title: 'Scrape: ' + params.url,
          canvas_node_id: canvasNodeId
        }
      });
      const r = result as unknown as Record<string, unknown>;
      if ((result as Record<string, unknown>).success) {
        console.log(`[DAG] node scrape success | nodeId=${node.id} | contentLength=${r.content ? String(r.content).length : 0} | sessionId=${r.session_id || '(none)'}`);
        const browseSessionId = r.session_id as string | undefined;
        if (browseSessionId && this.updateCanvasNode) {
          this.updateCanvasNode(canvasNodeId, { content: { sessionId: browseSessionId } });
          console.log(`[DAG] node scrape | wrote sessionId to canvas node | canvasNodeId=${canvasNodeId} | sessionId=${browseSessionId}`);
        }
      } else {
        console.error(`[DAG] node scrape failed | nodeId=${node.id} | error=${(result as Record<string, unknown>).error || 'browse_webview failed'}`);
      }
      return result;
    }

    if (node.type === 'llm_calc') {
      const params = node.params as { prompt: string; model?: string };
      const currentLLMConfig = this.getLLMConfig();
      if (!currentLLMConfig) {
        console.error(`[DAG] node llm_calc failed | nodeId=${node.id} | error=LLM configuration is required`);
        throw new Error('LLM configuration is required for llm_calc nodes');
      }
      const failedDep = Object.entries(depResults).find(([, val]) => {
        if (val && typeof val === 'object' && 'error' in val) return true;
        if (val && typeof val === 'object' && 'success' in val && (val as any).success === false) return true;
        return false;
      });
      if (failedDep) {
        const errMsg = `Dependency ${failedDep[0]} failed: ${JSON.stringify(failedDep[1])}`;
        console.error(`[DAG] node llm_calc failed | nodeId=${node.id} | error=${errMsg}`);
        throw new Error(errMsg);
      }
      const interpolatedPrompt = this.interpolateCodeWithDeps(params.prompt, depResults);
      console.log(`[DAG] node llm_calc | nodeId=${node.id} | model=${params.model || 'default'} | promptLength=${interpolatedPrompt.length}`);
      const provider = createLLMProvider(currentLLMConfig);
      const result = await provider.complete(
        [{ role: 'user', content: interpolatedPrompt }],
        { model: params.model }
      );
    const errMsg = (result as unknown as { error?: string }).error || 'LLM call failed';
    if (errMsg) {
      console.error(`[DAG] node llm_calc failed | nodeId=${node.id} | error=${errMsg}`);
      throw new Error(errMsg);
    }
    console.log(`[DAG] node llm_calc success | nodeId=${node.id} | responseLength=${String((result as unknown as Record<string, unknown>).content || '').length} | model=${(result as unknown as Record<string, unknown>).model}`);
      return (result as unknown as Record<string, unknown>).content;
    }

    console.error(`[DAG] unknown node type | nodeId=${node.id} | type=${node.type}`);
    throw new Error(`Unknown node type: ${node.type as string}`)
  }

  interpolateCodeWithDeps(code: string, deps: Record<string, unknown>): string {
    let result = code
    for (const [nodeId, depResult] of Object.entries(deps)) {
      result = result.replace(new RegExp(`\\$${nodeId}`, 'g'), JSON.stringify(depResult))
    }
    return result
  }

  async executeInSandbox(code: string, timeout: number = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const sandboxIframe = document.querySelector<HTMLIFrameElement>('#sandbox-iframe')
      
      if (!sandboxIframe?.contentWindow) {
        reject(new Error('Sandbox iframe not available'))
        return
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type !== 'SANDBOX_RESULT') return
        
        clearTimeout(timeoutId)
        window.removeEventListener('message', handleMessage)
        
        if (event.data.success) {
          resolve(event.data.result)
        } else {
          reject(new Error(event.data.error || 'Sandbox execution failed'))
        }
      }

      window.addEventListener('message', handleMessage)

      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handleMessage)
        reject(new Error('Execution timeout'))
      }, timeout)

      sandboxIframe.contentWindow.postMessage({
        type: 'SANDBOX_EXECUTE',
        code,
        timeout
      }, '*')
    })
  }

  async executeWebOpViaBackground(node: DAGNode, depResults: Record<string, unknown>): Promise<unknown> {
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

  topologicalSort(nodes: DAGNode[]): DAGNode[] {
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

  async executeWebviewDAGNode(node: DAGNode): Promise<unknown> {
    const params = node.params as BrowseDAGNodeParams;
    const toolCallMap: Record<string, string> = {
      'webview-browse': 'browse_webview',
      'webview-interact': 'interact_webview',
      'webview-extract': 'extract_webview_content'
    };
    const toolName = toolCallMap[node.type];
    if (!toolName) {
      throw new Error(`Unknown webview DAG node type: ${node.type}`);
    }

    console.log(`[DAG] executeWebviewDAGNode | nodeId=${node.id} | type=${node.type} → tool=${toolName}`);

    const args: Record<string, unknown> = {};
    if (node.type === 'webview-browse') {
      args.url = params.url || '';
      args.intent = params.intent || '';
      args.title = params.title;
    } else if (node.type === 'webview-interact') {
      args.session_id = params.sessionId || '';
      args.element_selector = params.elementSelector || '';
      args.action = params.action || 'click';
      args.value = params.value;
    } else if (node.type === 'webview-extract') {
      args.session_id = params.sessionId || '';
      args.selector = params.extractSelector || '';
      args.target = params.extractTarget || '';
    }

    const result = await this.executeTool({ name: toolName, arguments: args }) as Record<string, unknown>;
    if (!result.success) {
      throw new Error((result as { error?: string }).error || `${toolName} failed`);
    }
    return result;
  }

  updateWebviewDAGNode(type: string, status: 'success' | 'error', error?: string): void {
    if (!this.activeWebviewDAGPlanId || this.activeWebviewDAGNodes.length === 0) return;
    const idx = this.activeWebviewDAGNodes.findIndex(n => n.type === type);
    if (idx >= 0) {
      this.activeWebviewDAGNodes[idx] = {
        ...this.activeWebviewDAGNodes[idx],
        status,
        completedAt: Date.now(),
        ...(error ? { error } : {})
      };
      console.log(`[DAG] updateWebviewDAGNode | planId=${this.activeWebviewDAGPlanId} | type=${type} | status=${status} | error=${error || 'none'}`);
      if (type === 'webview-extract') {
        notifyDAGExecution(this.activeWebviewDAGPlanId, this.activeWebviewDAGNodes, status === 'success' ? 'completed' : 'failed');
      } else {
        notifyDAGExecution(this.activeWebviewDAGPlanId, this.activeWebviewDAGNodes, 'running');
      }
    }
  }

  skipWebviewDAGDependents(type: string): void {
    if (!this.activeWebviewDAGPlanId || this.activeWebviewDAGNodes.length === 0) return;
    const node = this.activeWebviewDAGNodes.find(n => n.type === type);
    if (!node) return;
    console.log(`[DAG] skipWebviewDAGDependents | planId=${this.activeWebviewDAGPlanId} | failedType=${type} | skipping deps of ${node.id}`);
    this.activeWebviewDAGNodes = this.activeWebviewDAGNodes.map(n =>
      n.dependencies.includes(node.id) ? { ...n, status: 'skipped' as const } : n
    );
    notifyDAGExecution(this.activeWebviewDAGPlanId, this.activeWebviewDAGNodes, 'failed');
  }

  setActiveWebviewDAG(planId: string | null, nodes: DAGNode[]): void {
    this.activeWebviewDAGPlanId = planId;
    this.activeWebviewDAGNodes = nodes;
  }

  getNodeResults(planId: string): Map<string, unknown> | undefined {
    return this.nodeResults.get(planId);
  }
}
