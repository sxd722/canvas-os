export type CanvasNodeType = 'text' | 'file' | 'summary' | 'code-result' | 'markdown' | 'web-view' | 'dag-node';

export type ResearchStatus = 'pending' | 'loading' | 'extracting' | 'summarizing' | 'complete' | 'error';

export type ExecutionStatus = 'pending' | 'running' | 'complete' | 'error' | 'timeout';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    tokens?: number;
    model?: string;
  };
}

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  content: string | object;
  position: { x: number; y: number };
  size: { width: number; height: number };
  title?: string;
  createdAt: number;
  source?: { type: string; ref: string };
}

export interface ResearchTask {
  id: string;
  url: string;
  status: ResearchStatus;
  tabId?: number;
  extractedText?: string;
  summary?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface SandboxExecution {
  id: string;
  code: string;
  status: ExecutionStatus;
  result?: unknown;
  error?: string;
  duration?: number;
  timeout: number;
  createdAt: number;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'glm' | 'custom';
  apiKey: string;
  endpoint?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CanvasState {
  offset: { x: number; y: number };
  scale: number;
  selectedNodeId?: string;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResponse {
  success: boolean;
  content?: unknown;
  error?: string;
  code?: string;
}

export type ExtractionMode = 'full' | 'readability' | 'data-points';

export interface ContentExtractionResult {
  success: boolean;
  content?: string;
  url: string;
  title?: string;
  metadata?: {
    wordCount: number;
    charCount: number;
    extractionTime: number;
  };
  error?: string;
  timestamp: number;
}
