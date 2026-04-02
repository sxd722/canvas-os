import { Tool, ToolCall, ToolResponse, LLMConfig, WebviewSession, PageExtraction, NavigationEntry } from '../../shared/types';
import type { DAGNode, BrowseDAGNodeParams } from '../../shared/dagSchema';
import { toolDefinitions } from '../../shared/toolDefinitions';
import { postToIframe, waitForExtraction, sendInteractionToIframe, waitForNavigationBack, sendExtractBySelector } from './webviewHelpers';
import { DAGEngine } from './dagEngine';

export { toolDefinitions } from '../../shared/toolDefinitions';
export { registerDAGExecutionCallback } from './dagEngine';
export type { DAGExecutionCallback } from './dagEngine';

export type ArtifactMetadata = {
  id: string;
  title: string;
  type: string;
  summary: string;
  size: number;
  createdAt: number;
}

export type ArtifactContentGetter = (id: string) => { content: unknown; type: string; size: number } | null;

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
  private artifactMetadataGetter: ArtifactMetadataGetter | null = null;
  private artifactContentGetter: ArtifactContentGetter | null = null;
  private webviewSessions: WebviewSessionAccessor | null = null;
  private dagEngine: DAGEngine;
  public addCanvasNode: ((node: any) => void) | null = null;
  public updateCanvasNode: ((nodeId: string, updates: Record<string, unknown>) => void) | null = null;

  constructor() {
    this.registerDefaultHandlers();
    this.dagEngine = new DAGEngine({
      executeTool: (call) => this.executeTool(call),
      addCanvasNode: this.addCanvasNode,
      updateCanvasNode: this.updateCanvasNode,
      getLLMConfig: () => currentLLMConfig
    });
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

      console.log(`[DAG] execute_dag | planId=${planId} | starting executeDAGWithWorkers...`);
      await this.dagEngine.executeDAGWithWorkers(planId, nodes);
      console.log(`[DAG] execute_dag | planId=${planId} | executeDAGWithWorkers completed`);

      const resultMap = this.dagEngine.getNodeResults(planId);
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
      const mode = (call.arguments.mode as string) || 'explore';
      let canvasNodeId = call.arguments.canvas_node_id as string | undefined;

      if (!canvasNodeId) {
        canvasNodeId = 'webview-' + Date.now();
        this.addCanvasNode?.({
          id: canvasNodeId,
          type: 'web-view',
          content: { url, title, status: 'loading' },
          position: { x: 200, y: 200 },
          size: { width: 400, height: 300 },
          createdAt: Date.now()
        });
        await new Promise(r => setTimeout(r, 100));
      }

      console.log(`[DAG] browse_webview called | url=${url} | intent=${intent} | title=${title} | canvasNodeId=${canvasNodeId}`);

      if (!this.webviewSessions) {
        return { success: false, error: 'Webview session manager not configured' };
      }

      try {
        new URL(url);
      } catch {
        return { success: false, status: 'error', error: `Invalid URL: ${url}` };
      }

      const session = this.webviewSessions.createSession(url, intent);
      if (canvasNodeId) {
        this.webviewSessions.updateSession(session.id, { canvasNodeId });
      }
      console.log(`[DAG] browse_webview session created | sessionId=${session.id} | nonce=${session.channelNonce} | canvasNodeId=${canvasNodeId || '(none)'}`);

      // T018: Generate webview browsing DAG plan
      const browseNodeId = `wv-browse-${session.id}`;
      const interactNodeId = `wv-interact-${session.id}`;
      const extractNodeId = `wv-extract-${session.id}`;
      this.dagEngine.setActiveWebviewDAG(
        `webview-plan-${Date.now()}`,
        [
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
        ]
      );

      // Wait for page to load via postMessage from iframe (up to 10s)
      console.log(`[DAG] browse_webview | waiting for extraction | sessionId=${session.id} | timeout=10000ms`);
      const extraction = await waitForExtraction(session.channelNonce, session.id, intent, 10000, url, canvasNodeId);
      console.log(`[DAG] browse_webview | extraction result | sessionId=${session.id} | success=${extraction.success} | elements=${extraction.elements?.length || 0} | error=${extraction.error || 'none'}`);

      this.webviewSessions.updateSession(session.id, {
        status: extraction.success ? 'loaded' : 'error',
        title: extraction.title || title,
        currentUrl: extraction.url || url
      });

      // T019: Update browse DAG node status
      if (!extraction.success) {
        this.dagEngine.updateWebviewDAGNode('webview-browse', 'error', extraction.error);
        this.dagEngine.skipWebviewDAGDependents('webview-browse');
      } else {
        this.dagEngine.updateWebviewDAGNode('webview-browse', 'success');
      }

      const extractionPayload = extraction.success
        ? {
            elements: extraction.elements || [],
            total_elements_found: extraction.totalElementsFound || 0,
            ...(mode === 'explore' ? {
              summary: extraction.summary || '',
              markdown_content: extraction.markdown_content || ''
            } : {})
          }
        : undefined;

      return {
        success: true,
        session_id: session.id,
        status: extraction.success ? 'loaded' : 'error',
        url: extraction.url || url,
        title: extraction.title || title,
        extraction: extractionPayload,
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
      const interactionResult = await sendInteractionToIframe(
        sessionId, session.channelNonce, elementSelector, action, value, session.canvasNodeId
      );
      console.log(`[DAG] interact_webview | interaction result | sessionId=${sessionId} | success=${interactionResult.success} | navigated=${interactionResult.navigated} | error=${interactionResult.error || 'none'}`);

      if (!interactionResult.success) {
        this.webviewSessions.updateSession(sessionId, { status: 'loaded' });
        // T019: Mark interact node as error, extract as skipped
        this.dagEngine.updateWebviewDAGNode('webview-interact', 'error', interactionResult.error);
        this.dagEngine.skipWebviewDAGDependents('webview-interact');
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

        extraction = await waitForExtraction(session.channelNonce, sessionId, session.intent, 10000, interactionResult.newUrl || session.currentUrl, session.canvasNodeId);
        this.webviewSessions.updateSession(sessionId, {
          currentUrl: interactionResult.newUrl || session.currentUrl,
          title: extraction.title || '',
          status: 'loaded'
        });
      } else {
        extraction = await waitForExtraction(session.channelNonce, sessionId, session.intent, 5000, session.currentUrl, session.canvasNodeId);
        this.webviewSessions.updateSession(sessionId, { status: 'loaded' });
      }

      // T019: Mark interact DAG node as success
      this.dagEngine.updateWebviewDAGNode('webview-interact', 'success');

      return {
        success: true,
        new_url: interactionResult.newUrl,
        navigated: interactionResult.navigated || false,
        extraction: extraction && extraction.success ? {
          summary: extraction.summary || '',
          elements: extraction.elements || [],
          total_elements_found: extraction.totalElementsFound || 0,
          markdown_content: extraction.markdown_content || ''
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

      // Send NAVIGATE_BACK command to the specific iframe by node-id (primary) or session-id (fallback)
      postToIframe(sessionId, {
        type: 'NAVIGATE_BACK',
        nonce: session.channelNonce
      }, session.canvasNodeId);

      // Wait for navigation to complete
      const navResult = await waitForNavigationBack(session.channelNonce, 10000);

      if (!navResult.success) {
        return { success: false, error: navResult.error || 'Navigation back failed' };
      }

      // Pop the last navigation entry
      const prevEntry = this.webviewSessions.popNavigationEntry(sessionId);
      const currentEntry = prevEntry; // The page we just went back to is the previous entry

      // Re-extract content from the page we went back to
      const extraction = await waitForExtraction(session.channelNonce, sessionId, session.intent, 10000, navResult.url || session.currentUrl, session.canvasNodeId);

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
      const extractResult = await sendExtractBySelector(sessionId, session.channelNonce, selector, session.canvasNodeId);
      console.log(`[DAG] extract_webview_content | result | sessionId=${sessionId} | success=${extractResult.success} | matchCount=${extractResult.matchCount} | error=${extractResult.error || 'none'}`);

      // T019: Update extract DAG node status
      this.dagEngine.updateWebviewDAGNode('webview-extract', extractResult.success ? 'success' : 'error', extractResult.error);
      if (!extractResult.success) {
        this.dagEngine.skipWebviewDAGDependents('webview-extract');
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
    return this.dagEngine.getNodeResults(planId);
  }
}

export const toolRegistry = new ToolRegistry();
