export type CanvasNodeType = 'text' | 'file' | 'summary' | 'code-result' | 'markdown' | 'web-view' | 'dag-node';

export type WebviewStatus = 'loading' | 'loaded' | 'interacting' | 'blocked' | 'error' | 'closed';
export type ElementType = 'link' | 'button' | 'input' | 'select' | 'textarea' | 'clickable-div' | 'other';

export interface WebviewSession {
  id: string;
  currentUrl: string;
  originalUrl: string;
  title: string;
  status: WebviewStatus;
  navigationHistory: NavigationEntry[];
  intent: string;
  interactionCount: number;
  maxInteractions: number;
  channelNonce: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface InteractiveElement {
  id: string;
  selector: string;
  xpath: string;
  type: ElementType;
  text: string;
  description: string;
  href?: string;
  inputType?: string;
  placeholder?: string;
  relevanceScore: number;
  boundingRect?: { x: number; y: number; width: number; height: number };
}

export interface PageExtraction {
  url: string;
  title: string;
  summary: string;
  elements: InteractiveElement[];
  extractionMethod: 'tfidf' | 'embedding' | 'heuristic' | 'css-selector';
  extractedAt: number;
  totalElementsFound: number;
  success: boolean;
  error?: string;
}

export interface BrowsingIntent {
  userMessage: string;
  keywords: string[];
  description: string;
  sessionId: string;
}

export interface NavigationEntry {
  url: string;
  title: string;
  timestamp: number;
  navigationType: string;
}

export type PopupToIframeMessage =
  | { type: 'EXTRACT_CONTENT'; nonce: string; intent: string }
  | { type: 'INTERACT_ELEMENT'; nonce: string; selector: string; action: 'click' | 'fill' | 'select'; value?: string }
  | { type: 'NAVIGATE_BACK'; nonce: string }
  | { type: 'GET_PAGE_STATUS'; nonce: string }
  | { type: 'EXTRACT_BY_SELECTOR'; nonce: string; selector: string };

export type IframeToPopupMessage =
  | { type: 'CONTENT_RESPONSE'; nonce: string; extraction: PageExtraction }
  | { type: 'INTERACTION_RESULT'; nonce: string; success: boolean; newUrl?: string; error?: string }
  | { type: 'NAVIGATION_COMPLETE'; nonce: string; url: string; title: string }
  | { type: 'PAGE_STATUS'; nonce: string; status: WebviewStatus; url: string }
  | { type: 'EXTRACT_RESULT'; nonce: string; data: string; success: boolean; error?: string };

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


