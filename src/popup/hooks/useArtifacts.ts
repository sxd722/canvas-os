import { useCallback } from 'react';
import type { CanvasNode } from '../../shared/types';
import type { ArtifactMetadata } from '../../shared/dagSchema';

interface UseArtifacts {
  getMetadata: () => ArtifactMetadata[];
  getContent: (id: string) => { content: unknown; type: string; size: number } | null;
}

export function useArtifacts(nodes: CanvasNode[]): UseArtifacts {
  const getMetadata = useCallback((): ArtifactMetadata[] => {
    return nodes.map((node): ArtifactMetadata => {
      let summary = '';
      let size = 0;

      if (typeof node.content === 'string') {
        summary = node.content.substring(0, 200);
        size = node.content.length;
      } else if (typeof node.content === 'object' && node.content !== null) {
        const contentObj = node.content as Record<string, unknown>;
        
        if (contentObj.content && typeof contentObj.content === 'string') {
          summary = contentObj.content.substring(0, 200) as string;
          size = (contentObj.fullLength as number) || (contentObj.content as string).length;
        } else if (contentObj.summary) {
          summary = String(contentObj.summary).substring(0, 200);
        } else if (contentObj.filename) {
          summary = `File: ${contentObj.filename}`;
        } else {
          summary = `${node.type} artifact`;
        }
      }

      return {
        id: node.id,
        title: node.title || 'Untitled',
        type: node.type,
        summary,
        size,
        createdAt: node.createdAt
      };
    });
  }, [nodes]);

  const getContent = useCallback((id: string): { content: unknown; type: string; size: number } | null => {
    const node = nodes.find((n): boolean => n.id === id);
    if (!node) return null;

    let content: unknown;
    let size = 0;

    if (typeof node.content === 'string') {
      content = node.content;
      size = node.content.length;
    } else if (typeof node.content === 'object' && node.content !== null) {
      const contentObj = node.content as Record<string, unknown>;
      
      if (contentObj.content && typeof contentObj.content === 'string') {
        content = contentObj.content;
        size = (contentObj.fullLength as number) || (contentObj.content as string).length;
      } else {
        content = node.content;
        size = JSON.stringify(node.content).length;
      }
    } else {
      content = node.content;
    }

    return { content, type: node.type, size };
  }, [nodes]);

  return {
    getMetadata,
    getContent
  };
}
