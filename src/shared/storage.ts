import type { ChatMessage, CanvasNode, LLMConfig, CanvasState } from './types';

const STORAGE_KEYS = {
  CHAT_MESSAGES: 'canvasos_chat_messages',
  CANVAS_NODES: 'canvasos_canvas_nodes',
  LLM_CONFIG: 'canvasos_llm_config',
  CANVAS_STATE: 'canvasos_canvas_state'
} as const;

export async function getChatMessages(): Promise<ChatMessage[]> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.CHAT_MESSAGES);
  return result[STORAGE_KEYS.CHAT_MESSAGES] || [];
}

export async function saveChatMessages(messages: ChatMessage[]): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEYS.CHAT_MESSAGES]: messages });
}

export async function addChatMessage(message: ChatMessage): Promise<void> {
  const messages = await getChatMessages();
  messages.push(message);
  await saveChatMessages(messages);
}

export async function getCanvasNodes(): Promise<CanvasNode[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CANVAS_NODES);
  return result[STORAGE_KEYS.CANVAS_NODES] || [];
}

export async function saveCanvasNodes(nodes: CanvasNode[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CANVAS_NODES]: nodes });
}

export async function addCanvasNode(node: CanvasNode): Promise<void> {
  const nodes = await getCanvasNodes();
  nodes.push(node);
  await saveCanvasNodes(nodes);
}

export async function getLLMConfig(): Promise<LLMConfig | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LLM_CONFIG);
  return result[STORAGE_KEYS.LLM_CONFIG] || null;
}

export async function saveLLMConfig(config: LLMConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.LLM_CONFIG]: config });
}

export async function getCanvasState(): Promise<CanvasState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CANVAS_STATE);
  return result[STORAGE_KEYS.CANVAS_STATE] || { offset: { x: 0, y: 0 }, scale: 1 };
}

export async function saveCanvasState(state: CanvasState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CANVAS_STATE]: state });
}

export async function clearSessionData(): Promise<void> {
  await chrome.storage.session.clear();
}
