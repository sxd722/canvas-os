import { useState, useCallback, useRef } from 'react';
import type { CanvasNode } from '../../shared/types';
import type { DAGNodeStatus, DAGNodeType, DAGNodeParams } from '../../shared/dagSchema';
import EmbeddedWebView from './EmbeddedWebView';

interface CanvasNodeComponentProps {
  node: CanvasNode;
  onDrag: (nodeId: string, deltaX: number, deltaY: number) => void;
  isHighlighted?: boolean;
}

interface DAGNodeContent {
  nodeId: string;
  nodeType: DAGNodeType;
  params: DAGNodeParams;
  dependencies: string[];
  status: DAGNodeStatus;
  result?: unknown;
  error?: string;
}

export default function CanvasNodeComponent({ node, onDrag, isHighlighted = false }: CanvasNodeComponentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        onDrag(node.id, deltaX, deltaY);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
    }, [isDragging, node.id, onDrag]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const renderContent = () => {
        switch (node.type) {
            case 'file':
                const fileContent = node.content as { 
                    filename: string; 
                    content: string; 
                    fullLength?: number;
                    isImage?: boolean;
                    ocrText?: string | null;
                    ocrError?: string;
                    ocrLoading?: boolean;
                };
                
                if (fileContent.isImage) {
                    return (
                        <div className="space-y-2">
                            <img 
                                src={fileContent.content} 
                                alt={fileContent.filename}
                                className="max-w-full max-h-32 object-contain rounded"
                            />
                            {fileContent.ocrLoading && (
                                <div className="text-xs text-blue-400 flex items-center gap-1">
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                    </svg>
                                    Running OCR...
                                </div>
                            )}
                            {fileContent.ocrText && (
                                <div className="mt-2 p-2 bg-gray-700 rounded text-xs text-gray-300 max-h-24 overflow-y-auto">
                                    <div className="font-medium text-gray-400 mb-1">Extracted Text:</div>
                                    {fileContent.ocrText}
                                </div>
                            )}
                            {fileContent.ocrError && (
                                <div className="text-xs text-red-400 mt-1">
                                    OCR Error: {fileContent.ocrError}
                                </div>
                            )}
                        </div>
                    );
                }
                
                return (
                    <div className="space-y-2">
                        <div className="text-xs text-gray-400">{fileContent.filename}</div>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-32 font-mono">
                            {fileContent.content}
                            {fileContent.fullLength && fileContent.fullLength > fileContent.content.length && (
                                <span className="text-gray-500">... ({fileContent.fullLength - fileContent.content.length} more chars)</span>
                            )}
                        </pre>
                    </div>
                );
            case 'summary':
                const summaryContent = node.content as { url: string; summary: string };
                return (
                    <div className="space-y-2">
                        <div className="text-xs text-blue-400 truncate">{summaryContent.url}</div>
                        <p className="text-xs text-gray-300">{summaryContent.summary}</p>
                    </div>
                );
            case 'code-result':
                const codeContent = node.content as { code: string; result?: unknown; error?: string; duration?: number };
                return (
                    <div className="space-y-2">
                        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">{codeContent.code}</pre>
                        <div className="border-t border-gray-600 pt-2">
                            {codeContent.error ? (
                                <div className="text-xs text-red-400">{codeContent.error}</div>
                            ) : (
                                <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono">
                                    {JSON.stringify(codeContent.result, null, 2)}
                                </pre>
                            )}
                            {codeContent.duration && (
                                <div className="text-xs text-gray-500 mt-1">{codeContent.duration}ms</div>
                            )}
                        </div>
                    </div>
                );
            case 'dag-node':
                const dagContent = node.content as DAGNodeContent;
                const statusColors: Record<DAGNodeStatus, string> = {
                    pending: 'border-gray-500 bg-gray-800',
                    running: 'border-blue-500 bg-blue-900 animate-pulse',
                    success: 'border-green-500 bg-green-900',
                    error: 'border-red-500 bg-red-900',
                    skipped: 'border-gray-400 bg-gray-700'
                };
                const statusIcons: Record<DAGNodeStatus, string> = {
                    pending: '⏳',
                    running: '🔄',
                    success: '✓',
                    error: '✗',
                    skipped: '⊘'
                };
                const typeLabels: Record<string, string> = {
                    'llm-call': 'LLM Call',
                    'js-execution': 'JS Execution',
                    'web-operation': 'Web Op',
                    'scrape': 'Scrape',
                    'llm_calc': 'LLM Calc'
                };
                return (
                    <div className={`space-y-2 ${statusColors[dagContent.status]}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{statusIcons[dagContent.status]}</span>
                                <span className="text-sm font-medium text-gray-200 truncate">{dagContent.nodeId}</span>
                            </div>
                            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                                {typeLabels[dagContent.nodeType]}
                            </span>
                        </div>
                        {dagContent.dependencies.length > 0 && (
                            <div className="text-xs text-gray-400">
                                Deps: {dagContent.dependencies.join(', ')}
                            </div>
                        )}
                        {dagContent.status === 'running' && (
                            <div className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4 text-blue-400" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                </svg>
                                <span className="text-xs text-blue-400">Executing...</span>
                            </div>
                        )}
                        {dagContent.error && (
                            <div className="p-2 bg-red-950 rounded text-xs text-red-300">
                                Error: {dagContent.error}
                            </div>
                        )}
                        {dagContent.result !== undefined && dagContent.status === 'success' && (
                            <div className="p-2 bg-green-950 rounded text-xs text-green-300">
                                <pre className="whitespace-pre-wrap overflow-auto max-h-20">
                                    {typeof dagContent.result === 'string' ? dagContent.result : JSON.stringify(dagContent.result, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                );
            case 'web-view':
                const webContent = node.content as { url: string; title: string; status: 'loading' | 'loaded' | 'blocked' | 'error' };
                return (
                    <EmbeddedWebView
                        url={webContent.url}
                        title={webContent.title}
                        nodeId={node.id}
                    />
                );
            default:
                return (
                    <p className="text-xs text-gray-300 whitespace-pre-wrap">
                        {typeof node.content === 'string' ? node.content : JSON.stringify(node.content)}
                    </p>
                );
        }
    };

    const getNodeColor = () => {
        switch (node.type) {
            case 'file': return 'border-blue-500';
            case 'summary': return 'border-green-500';
            case 'code-result': return 'border-purple-500';
            default: return 'border-gray-500';
        }
    };

    return (
        <div
            className={`absolute bg-gray-800 rounded-lg border-2 ${getNodeColor()} shadow-lg cursor-move select-none ${
                isHighlighted ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
            }`}
            style={{
                left: node.position.x,
                top: node.position.y,
                width: node.size.width,
                minHeight: node.size.height
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className="p-3">
                {node.title && (
                    <h3 className="text-sm font-medium text-gray-200 mb-2 truncate">{node.title}</h3>
                )}
                {renderContent()}
            </div>
        </div>
    );
}
