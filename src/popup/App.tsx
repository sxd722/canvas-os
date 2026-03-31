import { useState, useCallback, useRef, useEffect } from 'react';
import ChatPanel from './Chat/ChatPanel';
import CanvasPanel from './Canvas/CanvasPanel';
import Config from './components/LLMConfig/Config';
import ToolTesterPanel from './components/ToolTester/ToolTesterPanel';
import { extractTextFromImage, isImageFile } from './services/ocrService';
import { llmService } from './services/llmService';
import { useSandboxExecutor } from './hooks/useSandboxExecutor';
import { useDagEngine } from './hooks/useDagEngine';
import { HoverStateProvider } from './context/HoverStateContext';
import { toolRegistry } from './services/toolRegistry';
import { useArtifacts } from './hooks/useArtifacts';
import { useWebviewSessions } from './hooks/useWebviewSessions';
import { ToolTester } from './services/toolTester';
import type { ChatMessage, CanvasNode, LLMConfig } from '../shared/types';
import type { ConversationMessage } from './services/llmService';
import type { DAGPlan } from '../shared/dagSchema';
import { generateId } from '../shared/types';
import { getLLMConfig, saveLLMConfig, getCanvasNodes, saveCanvasNodes, getChatMessages, saveChatMessages } from '../shared/storage';
import { DAG_GENERATION_PROMPT_FLEXIBLE } from '../shared/dag-prompts';

const RESEARCH_PATTERN = /^research\s+(https?:\/\/[^\s]+)/i;
const MENTION_REGEX = /@\[([^\]]*)\]\(([^)]+)\)/g;
const OPEN_WEB_VIEW_PATTERN = /^open\s+(https?:\/\/[^\s]+)/i;

declare global {
  interface Window {
    toolTester?: ToolTester;
  }
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showToolTester, setShowToolTester] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const sandboxRef = useRef<HTMLIFrameElement>(null);
  const { executeInSandbox } = useSandboxExecutor(sandboxRef);
  const { subscribe } = useDagEngine();
  const { getMetadata, getContent } = useArtifacts(canvasNodes);
  const webviewSessions = useWebviewSessions();
  const toolTesterRef = useRef<ToolTester | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [savedConfig, savedNodes, savedMessages] = await Promise.all([
        getLLMConfig(),
        getCanvasNodes(),
        getChatMessages()
      ]);
      if (savedConfig) setConfig(savedConfig);
      setCanvasNodes(savedNodes);
      setMessages(savedMessages);
      
      toolTesterRef.current = new ToolTester(setCanvasNodes, setMessages);
      window.toolTester = toolTesterRef.current;
    };
    loadData();
  }, []);

  useEffect(() => {
    toolRegistry.setArtifactContentGetter(getContent);
    toolRegistry.setArtifactMetadataGetter(getMetadata);
    toolRegistry.setWebviewSessionAccessor(webviewSessions);
  }, [getContent, getMetadata, webviewSessions]);

  useEffect(() => {
    saveChatMessages(messages);
  }, [messages]);

  useEffect(() => {
    saveCanvasNodes(canvasNodes);
  }, [canvasNodes]);

  useEffect(() => {
    const unsubscribe = subscribe((plan: DAGPlan) => {
      console.log(`[App] DAG plan subscription | planId=${plan.id} | status=${plan.status} | nodeCount=${plan.nodes.length} | updating canvas nodes`);
      setCanvasNodes(prev => {
        const updatedNodes = [...prev];
        
        for (const dagNode of plan.nodes) {
          const canvasNodeId = `dag-node-${dagNode.id}`;
          const existingIndex = updatedNodes.findIndex(n => n.id === canvasNodeId);
          
          if (existingIndex >= 0) {
            updatedNodes[existingIndex] = {
              ...updatedNodes[existingIndex],
              content: {
                ...updatedNodes[existingIndex].content as object,
                status: dagNode.status,
                result: dagNode.result,
                error: dagNode.error
              }
            };
          }
        }
        
        return updatedNodes;
      });
    });
    
    return unsubscribe;
  }, [subscribe]);

  const buildContextWithMetadata = useCallback((userMessage: string): string => {
    const metadata = getMetadata();
    
    const mentionedIds: string[] = [];
    const matches = userMessage.matchAll(MENTION_REGEX);
    for (const match of matches) {
      mentionedIds.push(match[2]);
    }
    
    if (metadata.length === 0 && mentionedIds.length === 0) {
      return userMessage;
    }

    const parts: string[] = [userMessage];

    if (mentionedIds.length > 0) {
      parts.push('\n\n---\nReferenced artifacts (full content):');
      for (const id of mentionedIds) {
        const content = getContent(id);
        if (content) {
          const contentStr = typeof content.content === 'string' 
            ? content.content 
            : JSON.stringify(content.content, null, 2);
          parts.push(`\n[${content.type}: ${id}]\n${contentStr.substring(0, 2000)}${contentStr.length > 2000 ? '...(truncated)' : ''}`);
        }
      }
    }

    if (metadata.length > 0) {
      const contextInfo = metadata
        .filter(m => !mentionedIds.includes(m.id))
        .map((m, index) => 
          `[${index + 1}] ${m.title} (${m.type}) - ${m.summary.substring(0, 100)}${m.summary.length > 100 ? '...' : ''}`
        ).join('\n');

      if (contextInfo) {
        parts.push(`\n\nOther available artifacts on canvas:\n${contextInfo}\n\nUse the read_artifact_content tool to fetch full content if needed.`);
      }
    }

    return parts.join('');
  }, [getMetadata, getContent]);

  const handleToolCall = useCallback(async (toolCall: { name: string; arguments: Record<string, unknown> }) => {
    console.log(`[App] handleToolCall | name=${toolCall.name} | args=${JSON.stringify(toolCall.arguments).substring(0, 200)}`);
    try {
      let result: Awaited<ReturnType<typeof toolRegistry.executeTool>>;

      if (toolCall.name === 'browse_webview') {
        // Fix: create canvas node first so iframe exists, then wait for render before executing tool
        const url = toolCall.arguments.url as string;
        const title = (toolCall.arguments.title as string) || new URL(url).hostname;

        const webViewNode: CanvasNode = {
          id: generateId(),
          type: 'web-view',
          content: {
            url,
            title,
            status: 'loading'
          },
          position: { x: 100 + canvasNodes.length * 20, y: 100 + canvasNodes.length * 20 },
          size: { width: 400, height: 300 },
          title: title,
          createdAt: Date.now(),
          source: { type: 'web', ref: url }
        };

        setCanvasNodes(prev => [...prev, webViewNode]);

        const browseMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Browsing webview: ${url}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, browseMsg]);

        // Wait for React to render the iframe into the DOM
        await new Promise(r => setTimeout(r, 100));

        // Now execute the tool (which sends postMessage to the iframe)
        result = await toolRegistry.executeTool(toolCall);
      } else {
        result = await toolRegistry.executeTool(toolCall);
      }
      
      if (toolCall.name === 'execute_dag') {
        const nodes = toolCall.arguments.nodes as unknown[];
        const message: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Executing DAG plan with ${nodes?.length || 0} nodes...`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, message]);
      } else if (toolCall.name === 'read_artifact_content') {
        const artifactId = toolCall.arguments.artifactId as string;
        const artifactContent = getContent(artifactId);
        
        if (!artifactContent) {
          const message: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Artifact not found: ${artifactId}`,
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, message]);
          return;
        }

        const message: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Loaded artifact: ${artifactContent.type}, ${artifactContent.size} bytes\n\n${typeof artifactContent.content === 'string' ? artifactContent.content.substring(1, 1000) : JSON.stringify(artifactContent.content, null, 2).substring(1, 500)}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, message]);
      } else if (toolCall.name === 'open_web_view') {
        const url = toolCall.arguments.url as string;
        const title = (toolCall.arguments.title as string) || new URL(url).hostname;

        const webViewNode: CanvasNode = {
          id: generateId(),
          type: 'web-view',
          content: {
            url,
            title,
            status: 'loading'
          },
          position: { x: 100 + canvasNodes.length * 20, y: 100 + canvasNodes.length * 20 },
          size: { width: 400, height: 300 },
          title: title,
          createdAt: Date.now(),
          source: { type: 'web', ref: url }
        };

        setCanvasNodes(prev => [...prev, webViewNode]);

        const message: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Opening web view: ${url}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, message]);
      } else if (toolCall.name === 'interact_webview') {
        const sessionId = toolCall.arguments.sessionId as string;
        const action = toolCall.arguments.action as string;
        const interactMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Interacting with webview (${sessionId}): ${action}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, interactMsg]);
      } else if (toolCall.name === 'navigate_webview_back') {
        const sessionId = toolCall.arguments.sessionId as string;
        const navBackMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Navigating back in webview: ${sessionId}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, navBackMsg]);
      } else if (toolCall.name === 'extract_webview_content') {
        const sessionId = toolCall.arguments.sessionId as string;
        const selector = toolCall.arguments.selector as string;
        const extractMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Extracting content from webview (${sessionId})${selector ? ` using selector: ${selector}` : ''}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, extractMsg]);
      }
      console.log(`[App] handleToolCall | name=${toolCall.name} | completed`);
      return result;
    } catch (error) {
      console.error(`[App] handleToolCall | name=${toolCall.name} | error=${error instanceof Error ? error.message : 'Unknown error'}`);
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Tool call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [canvasNodes.length, getContent]);

  const handleSendMessage = useCallback(async (content: string) => {
    console.log(`[App] handleSendMessage | content=${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const researchMatch = content.match(RESEARCH_PATTERN);
      if (researchMatch) {
        const url = researchMatch[1];
        const response = await chrome.runtime.sendMessage({
          type: 'RESEARCH_URL',
          url,
          taskId: generateId()
        });
        
        if (response?.error) {
          const errorMessage: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Research failed: ${response.error}`,
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, errorMessage]);
        }
        setIsLoading(false);
        return;
      }

      const openViewMatch = content.match(OPEN_WEB_VIEW_PATTERN);
      if (openViewMatch) {
        const url = openViewMatch[1];
        const title = new URL(url).hostname;

        const webViewNode: CanvasNode = {
          id: generateId(),
          type: 'web-view',
          content: {
            url,
            title,
            status: 'loading'
          },
          position: { x: 100 + canvasNodes.length * 20, y: 100 + canvasNodes.length * 20 },
          size: { width: 400, height: 300 },
          title: title,
          createdAt: Date.now(),
          source: { type: 'web', ref: url }
        };

        setCanvasNodes(prev => [...prev, webViewNode]);

        const message: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Opening web view: ${url}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, message]);
        setIsLoading(false);
        return;
      }

      if (!config) {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'Please configure your LLM API key in Settings.',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
        setShowConfig(true);
        setIsLoading(false);
        return;
      }

      const contextMessage = buildContextWithMetadata(content)
        + '\n[Webview Tools] Use browse_webview (open URL + extract elements), interact_webview (click/fill), navigate_webview_back (go back), extract_webview_content (CSS selector extraction). browse_webview returns scored elements - pick highest relevance first.'
        + '\n\n' + DAG_GENERATION_PROMPT_FLEXIBLE;
      const response = await llmService.sendMessage(contextMessage, config, toolRegistry.getToolDefinitions());
      console.log(`[App] LLM response | contentLength=${response.content?.length || 0} | toolCalls=${response.toolCalls?.length || 0} | hasCode=${!!response.code}`);
      
      let currentContent = response.content;
      let currentToolCalls = response.toolCalls;

      // Agentic loop: keep sending tool results back to LLM until it stops requesting tools
      const MAX_TOOL_ROUNDS = 10;
      let rounds = 0;

      while (currentToolCalls && currentToolCalls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
        rounds++;
        console.log(`[App] agentic loop round ${rounds}/${MAX_TOOL_ROUNDS} | toolCalls=[${currentToolCalls.map(tc => tc.name).join(', ')}]`);

        // Build conversation history with tool results for the next LLM call
        const history: ConversationMessage[] = [
          { role: 'user', content: contextMessage }
        ];

        if (currentContent) {
          history.push({ role: 'assistant', content: currentContent });
        }

        // Execute all tool calls and collect results
        for (const toolCall of currentToolCalls) {
          const toolName = toolCall.name;
          // Execute tool (handleToolCall does executeTool + UI updates) and capture result
          const toolResult = await handleToolCall(toolCall);
          const resultContent = typeof toolResult === 'string'
            ? toolResult
            : JSON.stringify(toolResult, null, 2);
          // Truncate large results to avoid context overflow
          const truncated = resultContent.length > 4000
            ? resultContent.substring(0, 4000) + '\n...(truncated)'
            : resultContent;
          console.log(`[App] tool result | name=${toolName} | resultLength=${resultContent.length} | truncated=${resultContent.length > 4000}`);
          history.push({ role: 'assistant', content: '', name: toolName });
          history.push({ role: 'tool', content: truncated, name: toolName });
        }

        // Re-call LLM with updated history
        console.log(`[App] re-calling LLM | round=${rounds} | historyLength=${history.length}`);
        const nextResponse = await llmService.sendMessage(history, config, toolRegistry.getToolDefinitions());
        currentContent = nextResponse.content;
        currentToolCalls = nextResponse.toolCalls;

        if (currentContent) {
          const followUpMessage: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: currentContent,
            timestamp: Date.now(),
            metadata: { model: config.model }
          };
          setMessages(prev => [...prev, followUpMessage]);
        }
      }
      
      console.log(`[App] agentic loop ended | rounds=${rounds} | finalContent=${!!currentContent} | finalToolCalls=${currentToolCalls?.length || 0}`);
      
      if (!currentContent && rounds > 0) {
        // LLM produced no final content after tool rounds — add a summary message
        currentContent = `Completed ${rounds} round(s) of tool execution.`;
      }

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: currentContent,
        timestamp: Date.now(),
        metadata: { model: config.model }
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (response.code) {
        const result = await executeInSandbox(response.code, 10000);
        
        const codeResultNode: CanvasNode = {
          id: generateId(),
          type: 'code-result',
          content: { 
            code: response.code, 
            result: result.result, 
            error: result.error,
            duration: result.duration 
          },
          position: { x: 100 + canvasNodes.length * 20, y: 100 + canvasNodes.length * 20 },
          size: { width: 300, height: 200 },
          title: 'Code Execution',
          createdAt: Date.now(),
          source: { type: 'chat', ref: assistantMessage.id }
        };
        setCanvasNodes(prev => [...prev, codeResultNode]);

        const resultMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: result.error 
            ? `Execution error: ${result.error}` 
            : `Result: ${JSON.stringify(result.result)}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, resultMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [config, canvasNodes, executeInSandbox, buildContextWithMetadata, handleToolCall]);

  const handleLoadFile = useCallback(async () => {
    try {
      if (!('showOpenFilePicker' in window)) {
        alert('File System Access API is not supported in this browser.');
        return;
      }

      const [handle] = await (window as Window & { showOpenFilePicker: () => Promise<FileSystemFileHandle[]> }).showOpenFilePicker();
      const file = await handle.getFile();

      if (isImageFile(file.name)) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          
          const imageNode: CanvasNode = {
            id: generateId(),
            type: 'file',
            content: { 
              filename: file.name, 
              content: base64,
              isImage: true,
              ocrText: null,
              ocrLoading: true
            },
            position: { x: 100 + canvasNodes.length * 20, y: 100 + canvasNodes.length * 20 },
            size: { width: 350, height: 300 },
            title: file.name,
            createdAt: Date.now(),
            source: { type: 'file', ref: file.name }
          };
          setCanvasNodes(prev => [...prev, imageNode]);

          const message: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Loading image: ${file.name}...`,
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, message]);

          const ocrResult = await extractTextFromImage(base64);
          
          setCanvasNodes(prev => prev.map(node => {
            if (node.id === imageNode.id) {
              return {
                ...node,
                content: {
                  ...node.content as object,
                  ocrText: ocrResult.success ? ocrResult.text : null,
                  ocrError: ocrResult.error,
                  ocrLoading: false
                }
              };
            }
            return node;
          }));

          const ocrMessage: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: ocrResult.success 
              ? `Extracted text from ${file.name}:\n\n${ocrResult.text}` 
              : `OCR failed for ${file.name}: ${ocrResult.error}`,
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, ocrMessage]);
        };
        reader.readAsDataURL(file);
      } else {
        const content = await file.text();
        
        const fileNode: CanvasNode = {
          id: generateId(),
          type: 'file',
          content: { filename: file.name, content: content.slice(1, 5000), fullLength: content.length },
          position: { x: 100 + canvasNodes.length * 20, y: 100 + canvasNodes.length * 20 },
          size: { width: 350, height: 250 },
          title: file.name,
          createdAt: Date.now(),
          source: { type: 'file', ref: file.name }
        };
        setCanvasNodes(prev => [...prev, fileNode]);

        const message: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Loaded file: ${file.name} (${content.length} characters)`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, message]);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [canvasNodes.length]);

  const handleSaveConfig = useCallback(async (newConfig: LLMConfig) => {
    await saveLLMConfig(newConfig);
    setConfig(newConfig);
    setShowConfig(false);
  }, []);

  const handleClearCanvas = useCallback(() => {
    setCanvasNodes([]);
    setMessages([]);
  }, []);

  return (
    <HoverStateProvider>
      <div className="h-full w-full flex flex-col bg-gray-900 overflow-hidden">
        <header className="h-10 bg-gray-800 flex items-center justify-between px-4 border-b border-gray-700 shrink-0">
          <h1 className="text-sm font-semibold text-gray-200">CanvasOS</h1>
          <div className="flex gap-2">
            <button
              onClick={handleLoadFile}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white"
            >
              Load File
            </button>
            <button
              onClick={() => setShowToolTester(true)}
              className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 rounded text-white"
            >
              Test Tools
            </button>
            <button
              onClick={handleClearCanvas}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded text-white"
            >
              Clear
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded text-white"
            >
              Settings
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="w-[30%] border-r border-gray-700 flex flex-col min-h-0">
            <ChatPanel 
              messages={messages} 
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              canvasNodes={canvasNodes}
            />
          </div>
          <div className="w-[70%] relative min-h-0">
            {showConfig ? (
              <div className="absolute inset-0 bg-gray-900 z-10 p-4 overflow-auto">
                <Config config={config} onSave={handleSaveConfig} onCancel={() => setShowConfig(false)} />
              </div>
            ) : showToolTester ? (
              <ToolTesterPanel 
                canvasNodes={canvasNodes}
                setCanvasNodes={setCanvasNodes}
                setMessages={setMessages}
                onClose={() => setShowToolTester(false)}
              />
            ) : (
              <CanvasPanel 
                nodes={canvasNodes} 
                onNodesChange={setCanvasNodes}
              />
            )}
          </div>
        </div>

        <iframe
          ref={sandboxRef}
          id="sandbox-iframe"
          src="sandbox.html"
          sandbox="allow-scripts"
          className="hidden"
          title="Sandbox"
        />
      </div>
    </HoverStateProvider>
  );
}
