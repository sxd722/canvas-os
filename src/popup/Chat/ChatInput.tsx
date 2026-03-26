import React, { useState, useCallback, useRef, useEffect } from 'react';
import MentionDropdown from './MentionDropdown';
import { useHoverState } from '../context/HoverStateContext';
import type { CanvasNode } from '../../shared/types';

interface Artifact {
  id: string;
  title: string;
  type: string;
}

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
  canvasNodes: CanvasNode[];
}

export default function ChatInput({ onSend, disabled, canvasNodes }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { setHovered } = useHoverState();

  const artifacts: Artifact[] = canvasNodes.map(node => ({
    id: node.id,
    title: node.title || `${node.type} node`,
    type: node.type
  }));

  const filteredArtifacts = searchQuery
    ? artifacts.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
    : artifacts.slice(0, 8);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;
    setValue(newValue);

    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const hasSpaceAfterAt = textAfterAt.includes(' ');
      
      if (!hasSpaceAfterAt) {
        setMentionStart(lastAtIndex);
        setSearchQuery(textAfterAt);
        setShowDropdown(true);
        setDropdownIndex(0);
        return;
      }
    }
    
    setShowDropdown(false);
    setMentionStart(null);
    setSearchQuery('');
  }, []);

  const insertMention = useCallback((artifact: Artifact) => {
    if (mentionStart === null) return;
    
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const beforeMention = value.substring(0, mentionStart);
    const afterCursor = value.substring(cursorPos);
    const mentionText = `@[${artifact.title}](${artifact.id})`;
    
    const newValue = beforeMention + mentionText + ' ' + afterCursor;
    setValue(newValue);
    setShowDropdown(false);
    setMentionStart(null);
    setSearchQuery('');
    
    setTimeout(() => {
      const newPos = beforeMention.length + mentionText.length + 1;
      inputRef.current?.setSelectionRange(newPos, newPos);
      inputRef.current?.focus();
    }, 0);
  }, [value, mentionStart]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDropdownIndex(prev => 
          prev < filteredArtifacts.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDropdownIndex(prev => 
          prev > 0 ? prev - 1 : filteredArtifacts.length - 1
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredArtifacts[dropdownIndex]) {
          insertMention(filteredArtifacts[dropdownIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        setHovered(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend(value.trim());
        setValue('');
        setShowDropdown(false);
      }
    }
  }, [showDropdown, filteredArtifacts, dropdownIndex, insertMention, value, disabled, onSend, setHovered]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
      setShowDropdown(false);
    }
  }, [value, disabled, onSend]);

  useEffect(() => {
    if (showDropdown && filteredArtifacts[dropdownIndex]) {
      setHovered(filteredArtifacts[dropdownIndex].id);
    }
  }, [showDropdown, dropdownIndex, filteredArtifacts, setHovered]);

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-gray-700 bg-gray-800 relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Type @ to mention artifacts..."
            className="w-full bg-gray-700 text-gray-100 text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          {showDropdown && (
            <MentionDropdown
              artifacts={filteredArtifacts}
              selectedIndex={dropdownIndex}
              onSelect={insertMention}
              onClose={() => {
                setShowDropdown(false);
                setHovered(null);
              }}
            />
          )}
        </div>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </form>
  );
}
