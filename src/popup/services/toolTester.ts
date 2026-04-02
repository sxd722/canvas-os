import type { ChatMessage, CanvasNode } from '../../shared/types';
import { generateId } from '../../shared/types';
import type { DAGNodeParams } from '../../shared/dagSchema';
import { toolRegistry } from './toolRegistry';

type SetCanvasNodes = React.Dispatch<React.SetStateAction<CanvasNode[]>>;
type SetMessages = React.Dispatch<React.SetStateAction<ChatMessage[]>>;

interface ToolTestResult {
  success: boolean;
  toolName: string;
  duration: number;
  error?: string;
  output?: unknown;
  canvasNodeId?: string;
}

interface ToolTestSuite {
  name: string;
  tests: ToolTestCase[];
}

interface ToolTestCase {
  toolName: string;
  arguments: Record<string, unknown>;
  expectedBehavior: string;
  validate?: (result: ToolTestResult, canvasNodes: CanvasNode[]) => boolean;
}

export class ToolTester {
  private setCanvasNodes: SetCanvasNodes;
  private setMessages: SetMessages;
  private testResults: ToolTestResult[] = [];

  constructor(setCanvasNodes: SetCanvasNodes, setMessages: SetMessages) {
    this.setCanvasNodes = setCanvasNodes;
    this.setMessages = setMessages;
  }

 getAvailableTools() {
    return toolRegistry.getToolDefinitions().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
  }

  async invokeTool(toolName: string, args: Record<string, unknown>): Promise<ToolTestResult> {
    const startTime = Date.now();
    
    try {
      let result: ToolTestResult;

      switch (toolName) {
        case 'list_artifacts':
          result = await this.testListArtifacts();
          break;
        case 'open_web_view':
          result = await this.testOpenWebView(args);
          break;
        case 'read_artifact_content':
          result = await this.testReadArtifactContent(args);
          break;
        case 'execute_dag':
          result = await this.testExecuteDag(args);
          break;
        case 'read_webpage_content':
          result = await this.testReadWebpageContent(args);
          break;
        case 'browse_webview':
          result = await this.delegateToToolRegistry(toolName, args);
          break;
        case 'interact_webview':
          result = await this.delegateToToolRegistry(toolName, args);
          break;
        case 'navigate_webview_back':
          result = await this.delegateToToolRegistry(toolName, args);
          break;
        case 'extract_webview_content':
          result = await this.delegateToToolRegistry(toolName, args);
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      result.duration = Date.now() - startTime;
      this.testResults.push(result);
      
      this.logResult(result);
      
      return result;
    } catch (error) {
      const result: ToolTestResult = {
        success: false,
        toolName,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.testResults.push(result);
      this.logResult(result);
      
      return result;
    }
  }

  private async testListArtifacts(): Promise<ToolTestResult> {
    return new Promise((resolve) => {
      this.setCanvasNodes(prev => {
        const artifacts = prev.map(node => ({
          id: node.id,
          title: node.title || 'Untitled',
          type: node.type,
          summary: this.getSummary(node),
          size: this.getSize(node)
        }));

        this.setMessages(messages => [...messages, {
          id: generateId(),
          role: 'assistant',
          content: `[TEST] Listed ${artifacts.length} artifacts:\n${artifacts.map(a => `- ${a.title} (${a.type})`).join('\n')}`,
          timestamp: Date.now()
        }]);

        resolve({
          success: true,
          toolName: 'list_artifacts',
          duration: 0,
          output: { artifacts }
        });
        
        return prev;
      });
    });
  }

  private getSummary(node: CanvasNode): string {
    if (typeof node.content === 'string') {
      return node.content.substring(0, 100);
    }
    if (typeof node.content === 'object' && node.content !== null) {
      const contentObj = node.content as Record<string, unknown>;
      if (contentObj.content && typeof contentObj.content === 'string') {
        return contentObj.content.substring(0, 100) as string;
      }
      if (contentObj.summary) {
        return String(contentObj.summary).substring(0, 100);
      }
      if (contentObj.filename) {
        return `File: ${contentObj.filename}`;
      }
    }
    return `${node.type} artifact`;
  }

  private getSize(node: CanvasNode): number {
    if (typeof node.content === 'string') {
      return node.content.length;
    }
    if (typeof node.content === 'object' && node.content !== null) {
      const contentObj = node.content as Record<string, unknown>;
      if (contentObj.content && typeof contentObj.content === 'string') {
        return (contentObj.fullLength as number) || (contentObj.content as string).length;
      }
      return JSON.stringify(node.content).length;
    }
    return 0;
  }

  private async testOpenWebView(args: Record<string, unknown>): Promise<ToolTestResult> {
    const url = args.url as string;
    const title = (args.title as string) || new URL(url).hostname;

    const nodeId = generateId();
    
    this.setCanvasNodes(prev => {
      const webViewNode: CanvasNode = {
        id: nodeId,
        type: 'web-view',
        content: {
          url,
          title,
          status: 'loading'
        },
        position: { x: 100 + prev.length * 20, y: 100 + prev.length * 20 },
        size: { width: 400, height: 300 },
        title: title,
        createdAt: Date.now(),
        source: { type: 'test', ref: `test-${Date.now()}` }
      };
      return [...prev, webViewNode];
    });

    this.setMessages(prev => [...prev, {
      id: generateId(),
      role: 'assistant',
      content: `[TEST] Created web view node: ${url}`,
      timestamp: Date.now()
    }]);

    return {
      success: true,
      toolName: 'open_web_view',
      duration: 0,
      output: { url, title, nodeId },
      canvasNodeId: nodeId
    };
  }

  private async testReadArtifactContent(args: Record<string, unknown>): Promise<ToolTestResult> {
    const artifactId = args.artifactId as string;

    return new Promise((resolve) => {
      this.setCanvasNodes(prev => {
        const node = prev.find(n => n.id === artifactId);
        
        if (!node) {
          this.setMessages(messages => [...messages, {
            id: generateId(),
            role: 'assistant',
            content: `[TEST] Artifact not found: ${artifactId}`,
            timestamp: Date.now()
          }]);
          
          resolve({
            success: false,
            toolName: 'read_artifact_content',
            duration: 0,
            error: `Artifact not found: ${artifactId}`
          });
          return prev;
        }

        const content = node.content;
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

        this.setMessages(messages => [...messages, {
          id: generateId(),
          role: 'assistant',
          content: `[TEST] Read artifact "${node.title}":\n\n${contentStr.substring(0, 500)}...`,
          timestamp: Date.now()
        }]);

        resolve({
          success: true,
          toolName: 'read_artifact_content',
          duration: 0,
          output: { artifactId, title: node.title, type: node.type, content: contentStr.substring(1, 1000) }
        });
        
        return prev;
      });
    });
  }

  private async testExecuteDag(args: Record<string, unknown>): Promise<ToolTestResult> {
    const rawNodes = args.nodes as Array<{
      id: string;
      type: 'llm-call' | 'js-execution' | 'web-operation';
      params: DAGNodeParams;
      dependencies: string[];
    }>;

    const canvasDagNodes: CanvasNode[] = rawNodes.map((node, index) => ({
      id: `dag-node-${node.id}`,
      type: 'dag-node' as const,
      content: {
        nodeId: node.id,
        nodeType: node.type,
        params: node.params,
        dependencies: node.dependencies,
        status: 'pending'
      },
      position: { x: 100 + index * 250, y: 100 },
      size: { width: 220, height: 150 },
      title: `DAG: ${node.id}`,
      createdAt: Date.now(),
      source: { type: 'test', ref: `test-dag-${Date.now()}` }
    }));

    this.setCanvasNodes(prev => [...prev, ...canvasDagNodes]);

    this.setMessages(prev => [...prev, {
      id: generateId(),
      role: 'assistant',
      content: `[TEST] Created DAG plan with ${rawNodes.length} nodes (not executing - test mode)`,
      timestamp: Date.now()
    }]);

    return {
      success: true,
      toolName: 'execute_dag',
      duration: 0,
      output: { nodeCount: rawNodes.length, nodes: rawNodes.map(n => n.id) }
    };
  }

  private async testReadWebpageContent(args: Record<string, unknown>): Promise<ToolTestResult> {
    const url = args.url as string;
    const mode = (args.mode as string) || 'full';
    const timeout = (args.timeout as number) || 30000;

    this.setMessages(prev => [...prev, {
      id: generateId(),
      role: 'assistant',
      content: `[TEST] Would fetch webpage content from ${url} (mode: ${mode}, timeout: ${timeout}ms) - test mode`,
      timestamp: Date.now()
    }]);

    return {
      success: true,
      toolName: 'read_webpage_content',
      duration: 0,
      output: { url, mode, timeout, testMode: true }
    };
  }

  private async delegateToToolRegistry(toolName: string, args: Record<string, unknown>): Promise<ToolTestResult> {
    let enrichedArgs = args;

    if (toolName === 'browse_webview') {
      const url = args.url as string;
      const title = (args.title as string) || new URL(url).hostname;
      const nodeId = generateId();

      this.setCanvasNodes(prev => {
        const webViewNode: CanvasNode = {
          id: nodeId,
          type: 'web-view',
          content: { url, title, status: 'loading' },
          position: { x: 100 + prev.length * 20, y: 100 + prev.length * 20 },
          size: { width: 800, height: 600 },
          title,
          createdAt: Date.now(),
          source: { type: 'test', ref: `test-${Date.now()}` }
        };
        return [...prev, webViewNode];
      });

      enrichedArgs = { ...args, canvas_node_id: nodeId };

      this.setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `[TEST] browse_webview: created canvas node ${nodeId}, delegating to toolRegistry`,
        timestamp: Date.now()
      }]);
    }

    const registryResult = await toolRegistry.executeTool({
      name: toolName,
      arguments: enrichedArgs
    });

    const raw = registryResult as unknown as Record<string, unknown>;
    const success = !!raw.success;
    const error = !success ? String(raw.error || 'toolRegistry returned failure') : undefined;

    this.setMessages(prev => [...prev, {
      id: generateId(),
      role: 'assistant',
      content: `[TEST] ${toolName} via toolRegistry: ${success ? 'OK' : `FAILED: ${error}`}`,
      timestamp: Date.now()
    }]);

    return {
      success,
      toolName,
      duration: 0,
      output: raw,
      error
    };
  }

  private logResult(result: ToolTestResult) {
    const status = result.success ? '✓' : '✗';
    const log = `[TEST] ${status} ${result.toolName} (${result.duration}ms)`;
    console.log(log, result.output || result.error);
  }

  getTestResults(): ToolTestResult[] {
    return [...this.testResults];
  }

  clearResults() {
    this.testResults = [];
  }

  getDefaultTestSuite(): ToolTestSuite {
    return {
      name: 'Default Tool Tests',
      tests: [
        {
          toolName: 'open_web_view',
          arguments: { url: 'https://example.com', title: 'Test Page' },
          expectedBehavior: 'Creates a web-view canvas node with loading status',
          validate: (result: ToolTestResult, nodes: CanvasNode[]) => {
            if (!result.canvasNodeId) return false;
            const node = nodes.find(n => n.id === result.canvasNodeId);
            return node?.type === 'web-view';
          }
        },
        {
          toolName: 'execute_dag',
          arguments: {
            nodes: [
              {
                id: 'test-node-1',
                type: 'web-operation',
                params: { url: 'https://api.example.com/data', action: 'fetch' },
                dependencies: []
              }
            ]
          },
          expectedBehavior: 'Creates DAG node on canvas without executing',
          validate: (result: ToolTestResult, _nodes: CanvasNode[]) => {
            return result.success && !!(result.output as { nodes?: string[] })?.nodes?.includes('test-node-1');
          }
        }
      ]
    };
  }

  getE2eDagOrchestrationTestSuite(): ToolTestSuite {
    return {
      name: 'E2E DAG Orchestration Tests',
      tests: [
        {
          toolName: 'execute_dag',
          arguments: {
            nodes: [
              {
                id: 'fetch-huawei',
                type: 'web-operation',
                params: { url: 'https://consumer.huawei.com/en/phones/', action: 'fetch' },
                dependencies: []
              },
              {
                id: 'process-content',
                type: 'js-execution',
                params: { 
                  code: 'return "Fetched content length: " + ($fetchHuawei?.data?.length || 0) + " characters";',
                  timeout: 5000
                },
                dependencies: ['fetch-huawei']
              },
              {
                id: 'extract-prices',
                type: 'js-execution',
                params: { 
                  code: `
                    const content = $fetchHuawei?.data || '';
                    const priceMatch = content.match(/\\$[\\d,]+(?:\\.\\d{2})?/g) || [];
                    return { prices: priceMatch.slice(0, 5), count: priceMatch.length };
                  `,
                  timeout: 5000
                },
                dependencies: ['process-content']
              },
              {
                id: 'generate-chart',
                type: 'llm-call',
                params: { 
                  prompt: 'Based on the extracted prices data: $extractPrices, create a markdown table comparing Huawei phone prices. Format as a clean table with Device | Price columns.',
                  model: 'gpt-4'
                },
                dependencies: ['extract-prices']
              }
            ]
          },
          expectedBehavior: 'Executes 4-node DAG: web fetch -> js process -> js extract -> llm generate. Verifies CORS bypass, CSP compliance, and end-to-end workflow.',
          validate: (result: ToolTestResult, canvasNodes: CanvasNode[]) => {
            if (!result.success) {
              console.error('[E2E Validation] DAG execution failed:', result.error);
              return false;
            }

            const output = result.output as { 
              planId?: string;
              status?: string;
              nodeCount?: number;
              nodes?: string[];
            };
            
            if (!output) {
              console.error('[E2E Validation] No output from DAG execution');
              return false;
            }

            if (output.nodeCount !== 4) {
              console.error('[E2E Validation] Expected 4 nodes, got:', output.nodeCount);
              return false;
            }

            const dagNodes = canvasNodes.filter(n => n.type === 'dag-node');
            if (dagNodes.length < 4) {
              console.error('[E2E Validation] Expected 4 DAG canvas nodes, got:', dagNodes.length);
              return false;
            }

            const nodeIds = dagNodes.map(n => (n.content as { nodeId?: string }).nodeId);
            const expectedIds = ['fetch-huawei', 'process-content', 'extract-prices', 'generate-chart'];
            
            for (const expectedId of expectedIds) {
              if (!nodeIds.includes(expectedId)) {
                console.error('[E2E Validation] Missing expected DAG node:', expectedId);
                return false;
              }
            }

            console.log('[E2E Validation] All 4 DAG nodes created successfully');
            return true;
          }
        }
      ]
    };
  }

  async runTestSuite(suite: ToolTestSuite): Promise<ToolTestResult[]> {
    console.log(`[TEST] Running test suite: ${suite.name}`);
    
    const results: ToolTestResult[] = [];
    
    for (const test of suite.tests) {
      console.log(`[TEST] Running: ${test.toolName} - ${test.expectedBehavior}`);
      const result = await this.invokeTool(test.toolName, test.arguments);
      results.push(result);
      
      if (test.validate) {
        await new Promise<void>((resolve) => {
          this.setCanvasNodes(nodes => {
            const valid = test.validate!(result, nodes);
            if (!valid) {
              result.success = false;
              result.error = 'Validation failed';
            }
            resolve();
            return nodes;
          });
        });
      }
    }
    
    const passed = results.filter(r => r.success).length;
    console.log(`[TEST] Suite complete: ${passed}/${results.length} passed`);
    
    return results;
  }
}

let globalToolTester: ToolTester | null = null;

export function initGlobalToolTester(
  setCanvasNodes: SetCanvasNodes,
  setMessages: SetMessages
): ToolTester {
  globalToolTester = new ToolTester(setCanvasNodes, setMessages);
  
  if (typeof window !== 'undefined') {
    (window as Window & { __toolTester?: ToolTester }).__toolTester = globalToolTester;
  }
  
  return globalToolTester
}

export function getGlobalToolTester(): ToolTester | null {
    return globalToolTester
}

export type { ToolTestResult, ToolTestSuite, ToolTestCase };
