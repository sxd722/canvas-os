import type { CanvasNode } from './types';

export type MessageType = 
  | 'EXECUTE'
  | 'RESULT'
  | 'ERROR'
  | 'TIMEOUT'
  | 'RESEARCH_URL'
  | 'SCRAPE_RESULT'
  | 'CREATE_CANVAS_NODE'
  | 'SANDBOX_EXECUTE'
  | 'SANDBOX_RESULT';

export interface BaseMessage {
  type: MessageType;
}

export interface ExecuteMessage extends BaseMessage {
  type: 'EXECUTE';
  code: string;
  timeout: number;
  executionId: string;
}

export interface ResultMessage extends BaseMessage {
  type: 'RESULT';
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
  executionId: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  error: string;
  executionId?: string;
}

export interface TimeoutMessage extends BaseMessage {
  type: 'TIMEOUT';
  executionId: string;
}

export interface ResearchUrlMessage extends BaseMessage {
  type: 'RESEARCH_URL';
  url: string;
  taskId: string;
}

export interface ScrapeResultMessage extends BaseMessage {
  type: 'SCRAPE_RESULT';
  content: string;
  taskId: string;
  tabId: number;
}

export interface CreateCanvasNodeMessage extends BaseMessage {
  type: 'CREATE_CANVAS_NODE';
  node: Omit<CanvasNode, 'id' | 'createdAt'>;
}

export interface SandboxExecuteMessage extends BaseMessage {
  type: 'SANDBOX_EXECUTE';
  code: string;
  timeout: number;
  deps?: Record<string, unknown>;
}

export interface SandboxResultMessage extends BaseMessage {
  type: 'SANDBOX_RESULT';
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

export type AnyMessage = 
  | ExecuteMessage 
  | ResultMessage 
  | ErrorMessage 
  | TimeoutMessage
  | ResearchUrlMessage 
  | ScrapeResultMessage 
  | CreateCanvasNodeMessage
  | SandboxExecuteMessage
  | SandboxResultMessage;
