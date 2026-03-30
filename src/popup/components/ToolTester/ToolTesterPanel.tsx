import { useState, useCallback, useEffect, useMemo } from 'react';
import { ToolTester, ToolTestResult } from '../../services/toolTester';
import type { CanvasNode, ChatMessage } from '../../../shared/types';

const TOOL_EXAMPLE_ARGS: Record<string, string> = {
  list_artifacts: JSON.stringify({}, null, 2),
  read_artifact_content: JSON.stringify({
    artifactId: 'artifact-id-here'
  }, null, 2),
  open_web_view: JSON.stringify({
    url: 'https://example.com',
    title: 'Test Page'
  }, null, 2),
  read_webpage_content: JSON.stringify({
    url: 'https://example.com',
    mode: 'full'
  }, null, 2),
  browse_webview: JSON.stringify({
    url: 'https://example.com',
    intent: 'Find the main navigation links'
  }, null, 2),
  interact_webview: JSON.stringify({
    session_id: 'session-id-here',
    element_selector: 'a.nav-link',
    action: 'click'
  }, null, 2),
  navigate_webview_back: JSON.stringify({
    session_id: 'session-id-here'
  }, null, 2),
  extract_webview_content: JSON.stringify({
    session_id: 'session-id-here',
    selector: 'h1',
    target: 'Page title'
  }, null, 2),
  execute_dag: JSON.stringify({
    nodes: [
      {
        id: 'fetch-data',
        type: 'web-operation',
        params: { url: 'https://api.github.com/zen', action: 'fetch' },
        dependencies: []
      },
      {
        id: 'process-data',
        type: 'js-execution',
        params: { code: 'return deps["fetch-data"];', timeout: 5000 },
        dependencies: ['fetch-data']
      }
    ]
  }, null, 2)
};

const DEFAULT_TOOL = 'open_web_view';

interface ToolTesterPanelProps {
  canvasNodes: CanvasNode[];
  setCanvasNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onClose: () => void;
}

export default function ToolTesterPanel({ canvasNodes, setCanvasNodes, setMessages, onClose }: ToolTesterPanelProps) {
  const [testResults, setTestResults] = useState<ToolTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string>(DEFAULT_TOOL);
  const [toolArgs, setToolArgs] = useState<string>(TOOL_EXAMPLE_ARGS[DEFAULT_TOOL]);

  useEffect(() => {
    if (selectedTool && TOOL_EXAMPLE_ARGS[selectedTool]) {
      setToolArgs(TOOL_EXAMPLE_ARGS[selectedTool]);
    }
  }, [selectedTool]);

  const toolTester = useMemo(() => new ToolTester(setCanvasNodes, setMessages), [setCanvasNodes, setMessages]);
  const availableTools = toolTester.getAvailableTools();
  const selectedToolDef = availableTools.find((t: { name: string }) => t.name === selectedTool);

  const runSingleTest = useCallback(async () => {
    setIsRunning(true);
    try {
      const args = JSON.parse(toolArgs);
      const result = await toolTester.invokeTool(selectedTool, args);
      setTestResults(prev => [...prev, result]);
    } catch (error) {
      setTestResults(prev => [...prev, {
        toolName: selectedTool,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        timestamp: Date.now()
      }]);
    } finally {
      setIsRunning(false);
    }
  }, [selectedTool, toolArgs, toolTester]);

  const passedCount = testResults.filter(r => r.success).length;
  const failedCount = testResults.length - passedCount;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Tool Tester</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-1">Select Tool</label>
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="w-full bg-gray-700 text-gray-100 text-sm px-2 py-1 rounded border border-gray-600"
            >
              {availableTools.map((tool: { name: string }) => (
                <option key={tool.name} value={tool.name}>{tool.name}</option>
              ))}
            </select>
            {selectedToolDef && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{selectedToolDef.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Arguments (JSON)</label>
              <textarea
                value={toolArgs}
                onChange={(e) => setToolArgs(e.target.value)}
                className="w-full bg-gray-700 text-gray-100 text-xs px-2 py-1 rounded border border-gray-600 font-mono"
                rows={10}
                spellCheck={false}
              />
            </div>

            <div className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs text-gray-400">Actions</label>
                <span className="text-xs">
                  <span className="text-green-400">{passedCount} passed</span>
                  {failedCount > 0 && <span className="text-red-400 ml-2">, {failedCount} failed</span>}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={runSingleTest}
                  disabled={isRunning}
                  className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded"
                >
                  {isRunning ? 'Running...' : 'Run Tool'}
                </button>
              </div>
              <div className="flex-1 bg-gray-900 rounded p-2 overflow-y-auto min-h-0">
                {testResults.length === 0 ? (
                  <p className="text-xs text-gray-600">Click "Run Tool" to execute</p>
                ) : (
                  testResults.map((result, index) => (
                    <div key={index} className="mb-3">
                      <div className={`flex items-center justify-between text-xs mb-1 ${
                        result.success ? 'text-green-300' : 'text-red-300'
                      }`}>
                        <span>
                          <span className="mr-1">{result.success ? '✓' : '✗'}</span>
                          {result.toolName}
                          <span className="text-gray-500 ml-1">({result.duration}ms)</span>
                        </span>
                      </div>
                      {result.error && (
                        <div className="text-xs text-red-400 bg-red-950 rounded px-2 py-1 mb-1 font-mono break-all">
                          {result.error}
                        </div>
                      )}
                      {result.output != null && (
                        <pre className="text-xs text-gray-300 bg-gray-800 rounded px-2 py-1 font-mono whitespace-pre-wrap overflow-auto max-h-40 break-all">
                          {typeof result.output === 'string'
                            ? result.output
                            : JSON.stringify(result.output as Record<string, unknown>, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded p-2">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Canvas Nodes ({canvasNodes.length})</h3>
          {canvasNodes.length === 0 ? (
            <p className="text-xs text-gray-500">No nodes on canvas</p>
          ) : (
            <div className="max-h-32 overflow-y-auto">
              {canvasNodes.map(node => (
                <div key={node.id} className="flex items-center justify-between py-1 px-2 text-xs text-gray-300">
                  <span>
                    <span className="text-gray-500 mr-2">[{node.type}]</span>
                    {node.title || node.id}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
