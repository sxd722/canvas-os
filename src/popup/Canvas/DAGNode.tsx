import React from 'react';
import type { DAGNode } from '../../shared/dagSchema';

interface DAGNodeProps {
  node: DAGNode;
  position: { x: number; y: number };
  onDrag?: (nodeId: string, deltaX: number, deltaY: number) => void;
}

export function DAGNodeComponent({ node, position, onDrag }: DAGNodeProps) {
  const statusColors = {
    pending: 'border-gray-500 bg-gray-800',
    running: 'border-blue-500 bg-blue-900 animate-pulse',
    success: 'border-green-500 bg-green-900',
    error: 'border-red-500 bg-red-900',
    skipped: 'border-gray-400 bg-gray-700'
  };

  const statusIcons = {
    pending: '⏳',
    running: '🔄',
    success: '✓',
    error: '✗',
    skipped: '⊘'
  };

  const typeLabels = {
    'llm-call': 'LLM Call',
    'js-execution': 'JS Execution',
    'web-operation': 'Web Op'
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (onDrag) {
      e.stopPropagation();
    }
  };

  return (
    <div
      className={`absolute border-2 rounded-lg shadow-lg cursor-move select-none ${statusColors[node.status]}`}
      style={{
        left: position.x,
        top: position.y,
        width: 220,
        minHeight: 120
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{statusIcons[node.status]}</span>
            <h3 className="text-sm font-medium text-gray-200 truncate">
              {node.id}
            </h3>
          </div>
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
            {typeLabels[node.type]}
          </span>
        </div>

        <div className="space-y-2">
          <div className="text-xs">
            <span className="font-medium text-gray-300">Status:</span>
            <span className={`ml-2 ${
              node.status === 'success' ? 'text-green-400' :
              node.status === 'error' ? 'text-red-400' :
              node.status === 'running' ? 'text-blue-400' :
              'text-gray-400'
            }`}>
              {node.status.charAt(0).toUpperCase() + node.status.slice(1)}
            </span>
          </div>

          {node.dependencies.length > 0 && (
            <div className="text-xs">
              <span className="font-medium text-gray-300">Deps:</span>
              <span className="ml-2 text-gray-400">
                {node.dependencies.join(', ')}
              </span>
            </div>
          )}

          {node.status === 'running' && (
            <div className="flex items-center gap-2 mt-2">
              <svg className="animate-spin h-4 w-4 text-blue-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              <span className="text-xs text-blue-400">Executing...</span>
            </div>
          )}

          {node.error && (
            <div className="mt-2 p-2 bg-red-950 rounded text-xs text-red-300">
              <div className="font-medium text-red-400 mb-1">Error:</div>
              <div className="whitespace-pre-wrap overflow-auto max-h-20">
                {typeof node.error === 'string' ? node.error : JSON.stringify(node.error, null, 2)}
              </div>
            </div>
          )}

          {node.result !== undefined && node.status === 'success' && (
            <div className="mt-2 p-2 bg-green-950 rounded text-xs text-green-300">
              <div className="font-medium text-green-400 mb-1">Result:</div>
              <pre className="whitespace-pre-wrap overflow-auto max-h-20">
                {typeof node.result === 'string' ? node.result : JSON.stringify(node.result, null, 2)}
              </pre>
            </div>
          )}

          {node.startedAt && (
            <div className="text-xs text-gray-500 mt-2">
              Started: {new Date(node.startedAt).toLocaleTimeString()}
              {node.completedAt && (
                <span className="ml-2">
                  Duration: {node.completedAt - node.startedAt}ms
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
