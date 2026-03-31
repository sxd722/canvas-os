import { Tool, ToolCall, ToolResponse, LLMConfig, WebviewSession, PageExtraction, NavigationEntry } from '../../shared/types';
import type { DAGNode, BrowseDAGNodeParams } from '../../shared/dagSchema';
import { scoreElements } from './semanticExtractor';
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
    name: 'browse_webview',
    description: 'Open a URL in an embedded webview and extract relevant interactive elements based on a browsing intent',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open in the webview' },
        title: { type: 'string', description: 'Label for the webview node' },
        intent: { type: 'string', description: 'What you are looking for on this page' }
      },
      required: ['url', 'intent']
    }
  },
  {
    name: 'interact_webview',
    description: 'Interact with an element in an existing webview (click, fill input, select option)',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Webview session ID' },
        element_selector: { type: 'string', description: 'CSS selector of the element' },
        action: { type: 'string', enum: ['click', 'fill', 'select'], description: 'Action to perform' },
        value: { type: 'string', description: 'Value for fill/select actions' }
      },
      required: ['session_id', 'element_selector', 'action']
    }
  },
    {
    name: 'navigate_webview_back',
    description: 'Navigate back to the previous page in a webview session',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Webview session ID' }
      },
      required: ['session_id']
    }
  },
    {
    name: 'extract_webview_content',
    description: 'Extract specific content from a webview page using a CSS selector',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Webview session ID' },
        selector: { type: 'string', description: 'CSS selector for targeted extraction' },
        target: { type: 'string', description: 'Description of what data to extract' }
      },
      required: ['session_id', 'selector', 'target']
    }
  },
  {
    name: 'execute_dag',
    description: 'Execute a plan of interdependent tasks as a Directed Acyclic Graph (DAG). Independent tasks run concurrently. Node types: llm-call, js-execution, web-operation, webview-browse/interact/extract, scrape (browser tab with DOM extraction), llm_calc (LLM aggregation of predecessor results). Use this for complex multi-step workflows like price comparison, research + code generation + summarization.',
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
                enum: ['llm-call', 'js-execution', 'web-operation', 'webview-browse', 'webview-interact', 'webview-extract', 'scrape', 'llm_calc'],
                description: 'Type of execution for this node'
              },
              params: {
                type: 'object',
                description: 'Parameters: llm-call={prompt}, js-execution={code,timeout}, web-operation={url,action}, webview-browse={url,intent,title}, webview-interact={session_id,element_selector,action,value}, webview-extract={session_id,selector,target}, scrape={url,selector?,waitMs?,timeout?}, llm_calc={prompt,model?}'
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

export interface WebviewSessionAccessor {
  createSession: (url: string, intent: string) => WebviewSession;
  getSession: (id: string) => WebviewSession | undefined;
  updateSession: (id: string, partial: Partial<WebviewSession>) => void;
  closeSession: (id: string) => void;
  incrementInteraction: (id: string) => boolean;
  pushNavigationEntry: (id: string, entry: NavigationEntry) => void;
  popNavigationEntry: (id: string) => NavigationEntry | undefined;
}

export class ToolRegistry {
  private handlers: Map<string, (call: ToolCall) => Promise<ToolResponse>> = new Map();
  private workers: Map<string, Worker> = new Map();
  private nodeResults: Map<string, Map<string, unknown>> = new Map();
  private artifactMetadataGetter: ArtifactMetadataGetter | null = null;
  private artifactContentGetter: ArtifactContentGetter | null = null;
  private webviewSessions: WebviewSessionAccessor | null = null;
  private activeWebviewDAGPlanId: string | null = null;
  private activeWebviewDAGNodes: DAGNode[] = [];

  constructor() {
    this.registerDefaultHandlers();
  }

  setArtifactMetadataGetter(getter: ArtifactMetadataGetter): void {
    this.artifactMetadataGetter = getter;
  }

  setArtifactContentGetter(getter: ArtifactContentGetter): void {
    this.artifactContentGetter = getter;
  }

  setWebviewSessionAccessor(accessor: WebviewSessionAccessor): void {
    this.webviewSessions = accessor;
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

      console.log(`[DAG] execute_dag called | planId=${planId} | nodeCount=${nodes.length} | nodes=${nodes.map(n => `${n.id}(${n.type})`).join(', ')}`);

      notifyDAGExecution(planId, nodes.map(n => ({ ...n, status: 'pending' })), 'running');

      // Await DAG completion so we return actual results
      console.log(`[DAG] execute_dag | planId=${planId} | starting executeDAGWithWorkers...`);
      await this.executeDAGWithWorkers(planId, nodes);
      console.log(`[DAG] execute_dag | planId=${planId} | executeDAGWithWorkers completed`);

      // Collect results from nodeResults map
      const resultMap = this.nodeResults.get(planId);
      const resultsSummary = nodes.map(n => {
        const nodeResult = resultMap?.get(n.id);
        const isError = nodeResult && typeof nodeResult === 'object' && 'error' in (nodeResult as Record<string, unknown>);
        return {
          id: n.id,
          type: n.type,
          success: !isError,
          result: nodeResult
        };
      });

      const hasErrors = resultsSummary.some(r => !r.success);
      const completedCount = resultsSummary.filter(r => r.success).length;

      console.log(`[DAG] execute_dag finished | planId=${planId} | status=${hasErrors ? 'completed_with_errors' : 'completed'} | completed=${completedCount}/${nodes.length}`);

      return {
        success: true,
        content: {
          planId,
          status: hasErrors ? 'completed_with_errors' : 'completed',
          nodeCount: nodes.length,
          completedNodes: completedCount,
          failedNodes: resultsSummary.filter(r => !r.success).length,
          results: resultsSummary
        }
      };
    });

    // --- browse_webview handler (T010) ---
    this.registerHandler('browse_webview', async (call) => {
      const url = call.arguments.url as string;
      const title = (call.arguments.title as string) || (() => { try { return new URL(url).hostname; } catch { return url; } })();
      const intent = call.arguments.intent as string;

      console.log(`[DAG] browse_webview called | url=${url} | intent=${intent} | title=${title}`);

      if (!this.webviewSessions) {
        return { success: false, error: 'Webview session manager not configured' };
      }

      try {
        new URL(url);
      } catch {
        return { success: false, status: 'error', error: `Invalid URL: ${url}` };
      }

      const session = this.webviewSessions.createSession(url, intent);
      console.log(`[DAG] browse_webview session created | sessionId=${session.id} | nonce=${session.channelNonce}`);

      // T018: Generate webview browsing DAG plan
      this.activeWebviewDAGPlanId = `webview-plan-${Date.now()}`;
      this.activeWebviewDAGNodes = [
        {
          id: `webview-browse-${Date.now()}`,
          type: 'webview-browse',
          params: { type: 'webview-browse', url, intent, title } as BrowseDAGNodeParams,
          dependencies: [],
          status: 'running',
          startedAt: Date.now()
        },
        {
          id: `webview-interact-${Date.now()}`,
          type: 'webview-interact',
          params: { type: 'webview-interact', sessionId: session.id } as BrowseDAGNodeParams,
          dependencies: [`webview-browse-${Date.now()}`],
          status: 'pending'
        },
        {
          id: `webview-extract-${Date.now()}`,
          type: 'webview-extract',
          params: { type: 'webview-extract', sessionId: session.id } as BrowseDAGNodeParams,
          dependencies: [`webview-interact-${Date.now()}`],
          status: 'pending'
        }
      ];
      // Fix: use same IDs for dependencies (capture before spreading)
      const browseNodeId = `wv-browse-${session.id}`;
      const interactNodeId = `wv-interact-${session.id}`;
      const extractNodeId = `wv-extract-${session.id}`;
      this.activeWebviewDAGNodes = [
        {
          id: browseNodeId,
          type: 'webview-browse',
          params: { type: 'webview-browse', url, intent, title } as BrowseDAGNodeParams,
          dependencies: [],
          status: 'running',
          startedAt: Date.now()
        },
        {
          id: interactNodeId,
          type: 'webview-interact',
          params: { type: 'webview-interact', sessionId: session.id } as BrowseDAGNodeParams,
          dependencies: [browseNodeId],
          status: 'pending'
        },
        {
          id: extractNodeId,
          type: 'webview-extract',
          params: { type: 'webview-extract', sessionId: session.id } as BrowseDAGNodeParams,
          dependencies: [interactNodeId],
          status: 'pending'
        }
      ];
      notifyDAGExecution(this.activeWebviewDAGPlanId, this.activeWebviewDAGNodes, 'running');
      console.log(`[DAG] browse_webview DAG plan created | planId=${this.activeWebviewDAGPlanId} | nodes=${this.activeWebviewDAGNodes.map(n => `${n.id}(${n.type})`).join(', ')}`);

      // Wait for page to load via postMessage from iframe (up to 10s)
      console.log(`[DAG] browse_webview | waiting for extraction | sessionId=${session.id} | timeout=10000ms`);
      const extraction = await this.waitForExtraction(session.channelNonce, session.id, intent, 10000);
      console.log(`[DAG] browse_webview | extraction result | sessionId=${session.id} | success=${extraction.success} | elements=${extraction.elements?.length || 0} | error=${extraction.error || 'none'}`);

      this.webviewSessions.updateSession(session.id, {
        status: extraction.success ? 'loaded' : 'error',
        title: extraction.title || title,
        currentUrl: extraction.url || url
      });

      // T019: Update browse DAG node status
      if (this.activeWebviewDAGPlanId && this.activeWebviewDAGNodes.length > 0) {
        const browseNodeIdx = this.activeWebviewDAGNodes.findIndex(n => n.type === 'webview-browse');
        if (browseNodeIdx >= 0) {
          this.activeWebviewDAGNodes[browseNodeIdx] = {
            ...this.activeWebviewDAGNodes[browseNodeIdx],
            status: extraction.success ? 'success' : 'error',
            completedAt: Date.now(),
            error: extraction.error
          };
          // If browse failed, mark dependents as skipped
          if (!extraction.success) {
            const browseNodeId = this.activeWebviewDAGNodes[browseNodeIdx].id;
            this.activeWebviewDAGNodes = this.activeWebviewDAGNodes.map(n =>
              n.dependencies.includes(browseNodeId) ? { ...n, status: 'skipped' as const } : n
            );
            notifyDAGExecution(this.activeWebviewDAGPlanId, this.activeWebviewDAGNodes, 'failed');
          } else {
            notifyDAGExecution(this.activeWebviewDAGPlanId, this.activeWebviewDAGNodes, 'running');
          }
        }
      }

      return {
        success: true,
        session_id: session.id,
        status: extraction.success ? 'loaded' : 'error',
        url: extraction.url || url,
        title: extraction.title || title,
        extraction: extraction.success ? {
          summary: extraction.summary || '',
          elements: extraction.elements || [],
          total_elements_found: extraction.totalElementsFound || 0
        } : undefined,
        error: extraction.error
      };
    });

    // --- interact_webview handler (T011) ---
    this.registerHandler('interact_webview', async (call) => {
      const sessionId = call.arguments.session_id as string;
      const elementSelector = call.arguments.element_selector as string;
      const action = call.arguments.action as 'click' | 'fill' | 'select';
      const value = call.arguments.value as string | undefined;

      console.log(`[DAG] interact_webview called | sessionId=${sessionId} | selector=${elementSelector} | action=${action} | value=${value || '(none)'}`);

      if (!this.webviewSessions) {
        return { success: false, error: 'Webview session manager not configured' };
      }

      const session = this.webviewSessions.getSession(sessionId);
      if (!session) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }
      if (session.status === 'closed') {
        return { success: false, error: 'Session is closed' };
      }
      if (session.status === 'blocked') {
        return { success: false, error: 'Site blocks iframe embedding' };
      }

      if (!this.webviewSessions.incrementInteraction(sessionId)) {
        return { success: false, error: `Maximum interactions (${session.maxInteractions}) reached for this session` };
      }

      this.webviewSessions.updateSession(sessionId, { status: 'interacting' });

      // Send interaction command to iframe and wait for result
      console.log(`[DAG] interact_webview | sending INTERACT_ELEMENT | sessionId=${sessionId} | selector=${elementSelector} | action=${action}`);
      const interactionResult = await this.sendInteractionToIframe(
        sessionId, session.channelNonce, elementSelector, action, value
      );
      console.log(`[DAG] interact_webview | interaction result | sessionId=${sessionId} | success=${interactionResult.success} | navigated=${interactionResult.navigated} | error=${interactionResult.error || 'none'}`);

      if (!interactionResult.success) {
        this.webviewSessions.updateSession(sessionId, { status: 'loaded' });
        // T019: Mark interact node as error, extract as skipped
        this.updateWebviewDAGNode('webview-interact', 'error', interactionResult.error);
        this.skipWebviewDAGDependents('webview-interact');
        return { success: false, error: interactionResult.error || 'Interaction failed' };
      }

      // If navigation occurred, wait for new page and re-extract
      let extraction: PageExtraction | null = null;
      if (interactionResult.navigated) {
        this.webviewSessions.pushNavigationEntry(sessionId, {
          url: interactionResult.newUrl || session.currentUrl,
          title: '',
          timestamp: Date.now(),
          navigationType: 'interaction'
        });

        extraction = await this.waitForExtraction(session.channelNonce, sessionId, session.intent, 10000);
        this.webviewSessions.updateSession(sessionId, {
          currentUrl: interactionResult.newUrl || session.currentUrl,
          title: extraction.title || '',
          status: 'loaded'
        });
      } else {
        extraction = await this.waitForExtraction(session.channelNonce, sessionId, session.intent, 5000);
        this.webviewSessions.updateSession(sessionId, { status: 'loaded' });
      }

      // T019: Mark interact DAG node as success
      this.updateWebviewDAGNode('webview-interact', 'success');

      return {
        success: true,
        new_url: interactionResult.newUrl,
        navigated: interactionResult.navigated || false,
        extraction: extraction && extraction.success ? {
          summary: extraction.summary || '',
          elements: extraction.elements || [],
          total_elements_found: extraction.totalElementsFound || 0
        } : undefined
      };
    });

    // --- navigate_webview_back handler (T012) ---
    this.registerHandler('navigate_webview_back', async (call) => {
      const sessionId = call.arguments.session_id as string;

      if (!this.webviewSessions) {
        return { success: false, error: 'Webview session manager not configured' };
      }

      const session = this.webviewSessions.getSession(sessionId);
      if (!session) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }
      if (session.navigationHistory.length <= 1) {
        return { success: false, error: 'Already at the initial page, cannot go back' };
      }

      // Send NAVIGATE_BACK command to the specific iframe by session ID
      this.postToIframe(sessionId, {
        type: 'NAVIGATE_BACK',
        nonce: session.channelNonce
      });

      // Wait for navigation to complete
      const navResult = await this.waitForNavigationBack(session.channelNonce, 10000);

      if (!navResult.success) {
        return { success: false, error: navResult.error || 'Navigation back failed' };
      }

      // Pop the last navigation entry
      const prevEntry = this.webviewSessions.popNavigationEntry(sessionId);
      const currentEntry = prevEntry; // The page we just went back to is the previous entry

      // Re-extract content from the page we went back to
      const extraction = await this.waitForExtraction(session.channelNonce, sessionId, session.intent, 10000);

      this.webviewSessions.updateSession(sessionId, {
        currentUrl: navResult.url || (currentEntry?.url || session.currentUrl),
        title: navResult.title || (currentEntry?.title || session.title),
        status: 'loaded'
      });

      return {
        success: true,
        url: navResult.url || (currentEntry?.url || session.currentUrl),
        title: navResult.title || (currentEntry?.title || session.title),
        extraction: extraction && extraction.success ? {
          summary: extraction.summary || '',
          elements: extraction.elements || [],
          total_elements_found: extraction.totalElementsFound || 0
        } : undefined
      };
    });

    // --- extract_webview_content handler (T013) ---
    this.registerHandler('extract_webview_content', async (call) => {
      const sessionId = call.arguments.session_id as string;
      const selector = call.arguments.selector as string;
      const target = call.arguments.target as string;

      console.log(`[DAG] extract_webview_content called | sessionId=${sessionId} | selector=${selector} | target=${target}`);

      if (!this.webviewSessions) {
        return { success: false, error: 'Webview session manager not configured' };
      }

      const session = this.webviewSessions.getSession(sessionId);
      if (!session) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }
      if (session.status !== 'loaded' && session.status !== 'interacting') {
        return { success: false, error: `Session is not loaded (status: ${session.status})` };
      }

      // Validate CSS selector
      try {
        document.createElement('div').querySelector(selector);
      } catch {
        return { success: false, error: `Invalid CSS selector: ${selector}` };
      }

      // Send EXTRACT_BY_SELECTOR to iframe via postMessage
      const extractResult = await this.sendExtractBySelector(sessionId, session.channelNonce, selector);
      console.log(`[DAG] extract_webview_content | result | sessionId=${sessionId} | success=${extractResult.success} | matchCount=${extractResult.matchCount} | error=${extractResult.error || 'none'}`);

      // T019: Update extract DAG node status
      this.updateWebviewDAGNode('webview-extract', extractResult.success ? 'success' : 'error', extractResult.error);
      if (!extractResult.success) {
        this.skipWebviewDAGDependents('webview-extract');
      }

      return {
        success: extractResult.success,
        data: extractResult.data || '',
        selector,
        target,
        match_count: extractResult.matchCount || 0,
        error: extractResult.error
      };
    });
  }

  private async executeDAGWithWorkers(planId: string, nodes: DAGNode[]): Promise<void> {
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

  private async executeNodeWithWorker(node: DAGNode, depResults: Record<string, unknown>): Promise<unknown> {
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

        const message: Record<string, unknown> = {
          type: 'execute',
          nodeId: node.id,
          params: node.params,
          config: currentLLMConfig
        }

        worker.postMessage(message)
      })
    }

    // Webview DAG node types (T009)
    if (node.type === 'webview-browse' || node.type === 'webview-interact' || node.type === 'webview-extract') {
      console.log(`[DAG] node webview | nodeId=${node.id} | type=${node.type} | dispatching to executeWebviewDAGNode`);
      return this.executeWebviewDAGNode(node);
    }

    // Scrape node type — execute visually via canvas webview
    if (node.type === 'scrape') {
      const params = node.params as { url: string; selector?: string; waitMs?: number; timeout?: number };
      console.log(`[DAG] node scrape | nodeId=${node.id} | url=${params.url} | intent=extract page data for comparison | title=Scrape: ${params.url}`);
      const result = await this.executeTool({
        name: 'browse_webview',
        arguments: {
          url: params.url,
          intent: 'extract page data for comparison',
          title: 'Scrape: ' + params.url
        }
      });
      const r = result as unknown as Record<string, unknown>;
      if (result.success) {
        console.log(`[DAG] node scrape success | nodeId=${node.id} | contentLength=${r.content ? String(r.content).length : 0} | sessionId=${r.sessionId || '(none)'}`);
      } else {
        console.error(`[DAG] node scrape failed | nodeId=${node.id} | error=${result.error || 'browse_webview failed'}`);
      }
      return result;
    }

    // LLM Calc node type — interpolate deps into prompt and call LLM provider
    if (node.type === 'llm_calc') {
      const params = node.params as { prompt: string; model?: string };
      if (!currentLLMConfig) {
        console.error(`[DAG] node llm_calc failed | nodeId=${node.id} | error=LLM configuration is required`);
        throw new Error('LLM configuration is required for llm_calc nodes');
      }
      const interpolatedPrompt = this.interpolateCodeWithDeps(params.prompt, depResults);
      console.log(`[DAG] node llm_calc | nodeId=${node.id} | model=${params.model || 'default'} | promptLength=${interpolatedPrompt.length}`);
      const provider = createLLMProvider(currentLLMConfig);
      const result = await provider.complete(
        [{ role: 'user', content: interpolatedPrompt }],
        { model: params.model }
      );
      if (!result.success) {
        const errMsg = result.error || 'LLM call failed';
        console.error(`[DAG] node llm_calc failed | nodeId=${node.id} | error=${errMsg}`);
        throw new Error(errMsg);
      }
      console.log(`[DAG] node llm_calc success | nodeId=${node.id} | responseLength=${result.content?.length || 0} | model=${result.model}`);
      return result.content;
    }

    console.error(`[DAG] unknown node type | nodeId=${node.id} | type=${node.type}`);
    throw new Error(`Unknown node type: ${node.type as string}`)
  }

  private interpolateCodeWithDeps(code: string, deps: Record<string, unknown>): string {
    let result = code
    for (const [nodeId, depResult] of Object.entries(deps)) {
      result = result.replace(new RegExp(`\\$${nodeId}`, 'g'), JSON.stringify(depResult))
    }
    return result
  }

  private async executeInSandbox(code: string, timeout: number = 5000): Promise<unknown> {
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
    console.log(`[ToolRegistry] executeTool | name=${call.name} | args=${JSON.stringify(call.arguments).substring(0, 200)}`);
    const handler = this.handlers.get(call.name)
    if (!handler) {
      console.error(`[ToolRegistry] executeTool | unknown tool | name=${call.name}`);
      return {
        success: false,
        error: `Unknown tool: ${call.name}`,
        code: 'UNKNOWN_TOOL'
      }
    }
    const result = await handler(call)
    console.log(`[ToolRegistry] executeTool | name=${call.name} | success=${result.success}`);
    return result
  }

  getToolDefinitions(): Tool[] {
    return toolDefinitions
  }

  getNodeResults(planId: string): Map<string, unknown> | undefined {
    return this.nodeResults.get(planId);
  }

  // --- Webview DAG Node Handler (T009) ---

  private async executeWebviewDAGNode(node: DAGNode): Promise<unknown> {
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

    // Map DAG params to tool call arguments
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

    const result = await this.executeTool({ name: toolName, arguments: args });
    if (!result.success) {
      throw new Error((result as { error?: string }).error || `${toolName} failed`);
    }
    return result;
  }

  // --- Webview DAG Helper Methods (T018/T019) ---

  private updateWebviewDAGNode(type: string, status: 'success' | 'error', error?: string): void {
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
      // If extract completes, mark plan as completed
      if (type === 'webview-extract') {
        notifyDAGExecution(this.activeWebviewDAGPlanId, this.activeWebviewDAGNodes, status === 'success' ? 'completed' : 'failed');
      } else {
        notifyDAGExecution(this.activeWebviewDAGPlanId, this.activeWebviewDAGNodes, 'running');
      }
    }
  }

  private skipWebviewDAGDependents(type: string): void {
    if (!this.activeWebviewDAGPlanId || this.activeWebviewDAGNodes.length === 0) return;
    const node = this.activeWebviewDAGNodes.find(n => n.type === type);
    if (!node) return;
    console.log(`[DAG] skipWebviewDAGDependents | planId=${this.activeWebviewDAGPlanId} | failedType=${type} | skipping deps of ${node.id}`);
    this.activeWebviewDAGNodes = this.activeWebviewDAGNodes.map(n =>
      n.dependencies.includes(node.id) ? { ...n, status: 'skipped' as const } : n
    );
    notifyDAGExecution(this.activeWebviewDAGPlanId, this.activeWebviewDAGNodes, 'failed');
  }

  // --- Webview postMessage Helpers ---

  /**
   * Find the iframe element for a given session and postMessage to its contentWindow.
   * This avoids broadcasting to all iframes via window.postMessage.
   */
  private postToIframe(sessionId: string, message: Record<string, unknown>): void {
    const container = document.querySelector(`[data-node-id="${sessionId}"]`);
    if (!container) {
      console.warn(`[toolRegistry] No iframe container found for session ${sessionId}`);
      return;
    }
    const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) {
      console.warn(`[toolRegistry] Iframe or contentWindow not available for session ${sessionId}`);
      return;
    }
    iframe.contentWindow.postMessage(message, '*');
  }

  /**
   * Send EXTRACT_CONTENT to iframe and wait for CONTENT_RESPONSE.
   * Uses window.postMessage to communicate with the content script running in the iframe.
   */
  private waitForExtraction(nonce: string, sessionId: string, intent: string, timeoutMs: number): Promise<PageExtraction> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({
          url: '',
          title: '',
          summary: '',
          elements: [],
          extractionMethod: 'tfidf',
          extractedAt: Date.now(),
          totalElementsFound: 0,
          success: false,
          error: 'Extraction timed out'
        });
      }, timeoutMs);

      const handler = async (event: MessageEvent) => {
        const data = event.data;
        if (data?.nonce !== nonce) return;

        if (data?.type === 'CONTENT_RESPONSE' || data?.source === 'webview-bridge' && data?.type === 'EXTRACTION_RESULT') {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handler);

          // Handle both message formats (direct content script and bridge)
          const payload = data.extraction || data.payload;
          if (payload) {
            // Score elements with embedding model (fallback to TF-IDF) if intent provided
            if (intent && payload.elements && payload.elements.length > 0) {
              const scored = await scoreElements(intent, payload.elements.map((el: { text: string; description: string }) => ({
                text: el.text || '',
                description: el.description || ''
              })));

              // Merge scores back into elements
              const mergedElements = payload.elements.map((el: { text: string; description: string; relevanceScore?: number }) => {
                const scoredEl = scored.find(s => s.text === el.text && s.description === el.description);
                return {
                  ...el,
                  relevanceScore: scoredEl?.relevanceScore ?? el.relevanceScore ?? 0
                };
              });

              resolve({
                ...payload,
                elements: mergedElements,
                extractionMethod: 'tfidf',
                success: true
              });
            } else {
              resolve({ ...payload, extractionMethod: payload.extractionMethod || 'tfidf', success: true });
            }
          } else {
            resolve({
              url: '',
              title: '',
              summary: '',
              elements: [],
              extractionMethod: 'tfidf',
              extractedAt: Date.now(),
              totalElementsFound: 0,
              success: false,
              error: 'No extraction payload received'
            });
          }
        }
      };

      window.addEventListener('message', handler);

      // Send EXTRACT_CONTENT command to the specific iframe by session ID
      this.postToIframe(sessionId, {
        type: 'EXTRACT_CONTENT',
        nonce,
        intent,
        sessionId
      });
    });
  }

  /**
   * Send INTERACT_ELEMENT to iframe and wait for INTERACTION_RESULT.
   */
  private sendInteractionToIframe(
    sessionId: string,
    nonce: string,
    selector: string,
    action: 'click' | 'fill' | 'select',
    value?: string
  ): Promise<{ success: boolean; newUrl?: string; navigated?: boolean; error?: string }> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ success: false, error: 'Interaction timed out' });
      }, 10000);

      const handler = (event: MessageEvent) => {
        const data = event.data;
        if (data?.nonce !== nonce) return;

        if (data?.type === 'INTERACTION_RESULT' || (data?.source === 'webview-bridge' && data?.type === 'INTERACTION_RESULT')) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handler);
          const payload = data.payload || data;
          resolve({
            success: payload.success ?? false,
            newUrl: payload.newUrl,
            navigated: payload.navigated ?? false,
            error: payload.error
          });
        }
      };

      window.addEventListener('message', handler);

      // Send INTERACT_ELEMENT command to the specific iframe by session ID
      this.postToIframe(sessionId, {
        type: 'INTERACT_ELEMENT',
        nonce,
        selector,
        action,
        value
      });
    });
  }

  /**
   * Wait for NAVIGATION_COMPLETE after sending NAVIGATE_BACK.
   */
  private waitForNavigationBack(nonce: string, timeoutMs: number): Promise<{ success: boolean; url?: string; title?: string; error?: string }> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ success: false, error: 'Navigation back timed out' });
      }, timeoutMs);

      const handler = (event: MessageEvent) => {
        const data = event.data;
        if (data?.nonce !== nonce) return;

        if (data?.type === 'NAVIGATION_COMPLETE' || (data?.source === 'webview-bridge' && data?.type === 'NAVIGATION_COMPLETE')) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handler);
          const payload = data.payload || data;
          resolve({
            success: true,
            url: payload.url,
            title: payload.title
          });
        }
      };

      window.addEventListener('message', handler);
    });
  }

  /**
   * Send EXTRACT_BY_SELECTOR to iframe and wait for EXTRACT_RESULT.
   */
  private sendExtractBySelector(sessionId: string, nonce: string, selector: string): Promise<{ success: boolean; data?: string; matchCount?: number; error?: string }> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ success: false, error: 'Selector extraction timed out' });
      }, 10000);

      const handler = (event: MessageEvent) => {
        const data = event.data;
        if (data?.nonce !== nonce) return;

        if (data?.type === 'EXTRACT_RESULT' || (data?.source === 'webview-bridge' && data?.type === 'EXTRACT_RESULT')) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handler);
          const payload = data.payload || data;
          resolve({
            success: payload.success ?? true,
            data: payload.data || '',
            matchCount: payload.matchCount || (payload.data ? payload.data.split('\n').length : 0),
            error: payload.error
          });
        }
      };

      window.addEventListener('message', handler);

      // Send EXTRACT_BY_SELECTOR command to the specific iframe by session ID
      this.postToIframe(sessionId, {
        type: 'EXTRACT_BY_SELECTOR',
        nonce,
        selector
      });
    });
  }
}

export const toolRegistry = new ToolRegistry();