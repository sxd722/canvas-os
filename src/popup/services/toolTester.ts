import type { ChatMessage, CanvasNode } from '../../shared/types';
import { generateId } from '../../shared/types';
import type { DAGNodeParams } from '../../shared/dagSchema';

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
    return [
      {
        name: 'open_web_view',
        description: 'Open a URL as an embedded web view in the canvas',
        parameters: {
          url: { type: 'string', required: true, description: 'The URL to open' },
          title: { type: 'string', required: false, description: 'Optional title for the view' }
        }
      },
      {
        name: 'read_artifact_content',
        description: 'Read the full content of an artifact on the canvas',
        parameters: {
          artifactId: { type: 'string', required: true, description: 'The ID of the artifact to read' }
        }
      },
      {
        name: 'execute_dag',
        description: 'Execute a DAG plan with multiple nodes',
        parameters: {
          nodes: { 
            type: 'array', 
            required: true, 
            description: 'Array of DAG nodes to execute',
            items: {
              id: 'string',
              type: "'llm-call' | 'js-execution' | 'web-operation'",
              params: 'object',
              dependencies: 'string[]'
            }
          }
        }
      }
    ];
  }

  async invokeTool(toolName: string, args: Record<string, unknown>): Promise<ToolTestResult> {
    const startTime = Date.now();
    
    try {
      let result: ToolTestResult;

      switch (toolName) {
        case 'open_web_view':
          result = await this.testOpenWebView(args);
          break;
        case 'read_artifact_content':
          result = await this.testReadArtifactContent(args);
          break;
        case 'execute_dag':
          result = await this.testExecuteDag(args);
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
          output: { artifactId, title: node.title, type: node.type, content: contentStr.substring(0, 1000) }
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

// Global instance for CDP access
let globalToolTester: ToolTester | null = null;

export function initGlobalToolTester(
  setCanvasNodes: SetCanvasNodes,
  setMessages: SetMessages
): ToolTester {
  globalToolTester = new ToolTester(setCanvasNodes, setMessages);
  
  // Expose to window for CDP access
  if (typeof window !== 'undefined') {
    (window as Window & { __toolTester?: ToolTester }).__toolTester = globalToolTester;
  }
  
  return globalToolTester;
}

export function getGlobalToolTester(): ToolTester | null {
  return globalToolTester;
}

export type { ToolTestResult, ToolTestSuite, ToolTestCase };
