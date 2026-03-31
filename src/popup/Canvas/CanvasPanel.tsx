import { useState, useCallback, useRef, useMemo } from 'react';
import { useHoverState } from '../context/HoverStateContext';
import InfiniteCanvas from './InfiniteCanvas';
import CanvasNodeComponent from './CanvasNode';
import type { CanvasNode, CanvasState } from '../../shared/types';

interface CanvasPanelProps {
  nodes: CanvasNode[];
  onNodesChange: (nodes: CanvasNode[]) => void;
  highlightedNodeId?: string | null;
}

/** Build SVG paths for DAG dependency arrows */
function buildDAGEdges(nodes: CanvasNode[]): { paths: string; defs: string } {
  const dagNodes = nodes.filter(n => n.type === 'dag-node');
  if (dagNodes.length === 0) return { paths: '', defs: '' };

  const nodeMap = new Map(dagNodes.map(n => [n.id, n]));
  const edgePaths: string[] = [];

  for (const node of dagNodes) {
    const content = node.content as { dependencies?: string[] } | undefined;
    if (!content?.dependencies) continue;

    const targetX = node.position.x + node.size.width / 2;
    const targetY = node.position.y;

    for (const depId of content.dependencies) {
      const parentId = `dag-node-${depId}`;
      const parent = nodeMap.get(parentId);
      if (!parent) continue;

      const sourceX = parent.position.x + parent.size.width / 2;
      const sourceY = parent.position.y + parent.size.height;
      const midY = (sourceY + targetY) / 2;

      edgePaths.push(
        `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`
      );
    }
  }

  if (edgePaths.length === 0) return { paths: '', defs: '' };

  return {
    paths: edgePaths.map(d => `<path d="${d}" fill="none" stroke="#4B5563" stroke-width="2" stroke-linecap="round"/>`).join(''),
    defs: `<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#4B5563"/></marker>`
  };
}

export default function CanvasPanel({ nodes, onNodesChange, highlightedNodeId }: CanvasPanelProps) {
  const { hoveredNodeId } = useHoverState();
  const [canvasState, setCanvasState] = useState<CanvasState>({
    offset: { x: 0, y: 0 },
    scale: 1
  });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleCanvasDrag = useCallback((e: React.MouseEvent) => {
    if (!isDragging || draggedNodeId) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    setCanvasState(prev => ({
      ...prev,
      offset: {
        x: prev.offset.x + deltaX,
        y: prev.offset.y + deltaY
      }
    }));
    
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, [isDragging, draggedNodeId]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNodeId(null);
  }, []);

  const handleNodeDrag = useCallback((nodeId: string, deltaX: number, deltaY: number) => {
    onNodesChange(nodes.map(node => {
      if (node.id === nodeId) {
        return {
          ...node,
          position: {
            x: node.position.x + deltaX / canvasState.scale,
            y: node.position.y + deltaY / canvasState.scale
          }
        };
      }
      return node;
    }));
  }, [nodes, canvasState.scale, onNodesChange]);

  const handleZoom = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCanvasState(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(3, prev.scale * delta))
    }));
  }, []);

  const { paths, defs } = useMemo(() => buildDAGEdges(nodes), [nodes]);

  return (
    <div 
      className="w-full h-full bg-gray-900 overflow-hidden cursor-grab active:cursor-grabbing canvas-bg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleCanvasDrag}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleZoom}
    >
      <InfiniteCanvas offset={canvasState.offset} scale={canvasState.scale}>
        {paths && (
          <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible', width: 1, height: 1 }}>
            <defs>{defs}</defs>
            <g>{paths}</g>
          </svg>
        )}
        {nodes.map(node => (
          <CanvasNodeComponent
            key={node.id}
            node={node}
            onDrag={handleNodeDrag}
            isHighlighted={highlightedNodeId === node.id || hoveredNodeId === node.id}
          />
        ))}
      </InfiniteCanvas>
    </div>
  );
}
