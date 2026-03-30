export type DAGNodeStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export type DAGNodeType = 'llm-call' | 'js-execution' | 'web-operation' | 'scrape' | 'llm_calc' | 'webview-browse' | 'webview-interact' | 'webview-extract';

export interface LLMCallParams {
  type: 'llm-call';
  prompt: string;
  model?: string;
}

export interface JSExecutionParams {
  type: 'js-execution';
  code: string;
  timeout?: number;
}

export interface WebOperationParams {
  type: 'web-operation';
  url: string;
  action: 'fetch' | 'screenshot';
}

export interface ScrapeParams {
  type: 'scrape';
  url: string;
  selector?: string;
  waitMs?: number;
  timeout?: number;
}

export interface LLMCalcParams {
  type: 'llm_calc';
  prompt: string;
  model?: string;
}

export interface BrowseDAGNodeParams {
  type?: 'webview-browse' | 'webview-interact' | 'webview-extract';
  url?: string;
  title?: string;
  sessionId?: string;
  elementSelector?: string;
  action?: 'click' | 'fill' | 'select';
  value?: string;
  extractSelector?: string;
  extractTarget?: string;
  intent?: string;
}

export type DAGNodeParams = LLMCallParams | JSExecutionParams | WebOperationParams | ScrapeParams | LLMCalcParams | BrowseDAGNodeParams;

export interface DAGNode {
  id: string;
  type: DAGNodeType;
  params: DAGNodeParams;
  dependencies: string[];
  status: DAGNodeStatus;
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  artifactId?: string;
}

export interface DAGPlan {
  id: string;
  nodes: DAGNode[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  completedAt?: number;
  triggeredBy: string;
}

export interface ArtifactMetadata {
  id: string;
  title: string;
  type: string;
  summary: string;
  size: number;
  createdAt: number;
  mentionedIn?: string[];
}

export interface Mention {
  artifactId: string;
  displayText: string;
  startIndex: number;
  endIndex: number;
}

export interface EmbeddedWebView {
  id: string;
  type: 'web-view';
  url: string;
  title: string;
  status: 'loading' | 'loaded' | 'blocked' | 'error';
  lastAccessed: number;
  blockedReason?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  createdAt: number;
}

export const DAG_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'type', 'params', 'dependencies'],
    properties: {
      id: { type: 'string' },
      type: {
        type: 'string',
        enum: ['llm-call', 'js-execution', 'web-operation', 'scrape', 'llm_calc', 'webview-browse', 'webview-interact', 'webview-extract']
      }
    }
  }
};
