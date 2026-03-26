import React from 'react';
import ChatInput from './ChatInput';
import ChatMessageComponent from './ChatMessage';
import type { ChatMessage, CanvasNode } from '../../shared/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  canvasNodes: CanvasNode[];
}

export default function ChatPanel({ messages, onSendMessage, isLoading, canvasNodes }: ChatPanelProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-gray-500 text-sm text-center mt-8">
            Start a conversation or type &quot;Research [URL]&quot; to scrape a webpage.
          </div>
        )}
        {messages.map((message) => (
          <ChatMessageComponent key={message.id} message={message} canvasNodes={canvasNodes} />
        ))}
        {isLoading && (
          <div className="text-gray-400 text-sm">Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSend={onSendMessage} disabled={isLoading} canvasNodes={canvasNodes} />
    </div>
  );
}
