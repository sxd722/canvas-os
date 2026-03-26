import { useState, useCallback, useMemo } from 'react';
import type { CanvasNode } from '../../shared/types';

export interface Mention {
  id: string;
  artifactId: string;
  title: string;
  type: string;
}

const MENTION_REGEX = /@\[([^\]]*)\]\(([^)]+)\)/g;

export function useMentions(canvasNodes: CanvasNode[]) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const artifacts = useMemo(() => 
    canvasNodes.map(node => ({
      id: node.id,
      title: node.title || `${node.type} node`,
      type: node.type
    })),
    [canvasNodes]
  );

  const filteredArtifacts = useMemo(() => {
    if (!searchQuery) return artifacts.slice(0, 10);
    const query = searchQuery.toLowerCase();
    return artifacts
      .filter(a => a.title.toLowerCase().includes(query))
      .slice(0, 10);
  }, [artifacts, searchQuery]);

  const addMention = useCallback((artifactId: string, title: string, type: string) => {
    const mention: Mention = {
      id: `mention-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      artifactId,
      title,
      type
    };
    setMentions(prev => [...prev, mention]);
    return mention;
  }, []);

  const removeMention = useCallback((mentionId: string) => {
    setMentions(prev => prev.filter(m => m.id !== mentionId));
  }, []);

  const clearMentions = useCallback(() => {
    setMentions([]);
  }, []);

  const extractMentionsFromText = useCallback((text: string): Mention[] => {
    const extracted: Mention[] = [];
    const matches = text.matchAll(MENTION_REGEX);
    
    for (const match of matches) {
      const [, title, artifactId] = match;
      const artifact = artifacts.find(a => a.id === artifactId);
      if (artifact) {
        extracted.push({
          id: `mention-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          artifactId,
          title,
          type: artifact.type
        });
      }
    }
    
    return extracted;
  }, [artifacts]);

  const getMentionedArtifactIds = useCallback((text: string): string[] => {
    const ids: string[] = [];
    const matches = text.matchAll(MENTION_REGEX);
    
    for (const match of matches) {
      const artifactId = match[2];
      if (!ids.includes(artifactId)) {
        ids.push(artifactId);
      }
    }
    
    return ids;
  }, []);

  const formatMention = useCallback((artifactId: string, title: string): string => {
    return `@[${title}](${artifactId})`;
  }, []);

  const openDropdown = useCallback((query: string = '') => {
    setSearchQuery(query);
    setSelectedIndex(0);
    setShowDropdown(true);
  }, []);

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);

  const selectNext = useCallback(() => {
    setSelectedIndex(prev => 
      prev < filteredArtifacts.length - 1 ? prev + 1 : 0
    );
  }, [filteredArtifacts.length]);

  const selectPrev = useCallback(() => {
    setSelectedIndex(prev => 
      prev > 0 ? prev - 1 : filteredArtifacts.length - 1
    );
  }, [filteredArtifacts.length]);

  return {
    mentions,
    showDropdown,
    selectedIndex,
    searchQuery,
    filteredArtifacts,
    addMention,
    removeMention,
    clearMentions,
    extractMentionsFromText,
    getMentionedArtifactIds,
    formatMention,
    openDropdown,
    closeDropdown,
    selectNext,
    selectPrev,
    setSearchQuery
  };
}
