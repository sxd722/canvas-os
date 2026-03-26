import { useHoverState } from '../context/HoverStateContext';
import type { ChatMessage, CanvasNode } from '../../shared/types';

const MENTION_REGEX = /(@\[([^\]]*)\]\(([^)]+)\))/g;

interface ChatMessageProps {
  message: ChatMessage;
  canvasNodes: CanvasNode[];
}

function renderContentWithMentions(
  content: string, 
  setHovered: (id: string | null) => void,
  canvasNodes: CanvasNode[]
) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  const matches = [...content.matchAll(MENTION_REGEX)];
  
  if (matches.length === 0) {
    return content;
  }

  for (const match of matches) {
    const [fullMatch, , title, artifactId] = match;
    const matchIndex = match.index ?? 0;
    const artifactExists = canvasNodes.some(node => node.id === artifactId);
    
    if (matchIndex > lastIndex) {
      parts.push(content.substring(lastIndex, matchIndex));
    }
    
    if (artifactExists) {
      parts.push(
        <span
          key={key++}
          className="bg-blue-600/30 text-blue-300 px-1 rounded cursor-pointer hover:bg-blue-600/50 transition-colors"
          onMouseEnter={() => setHovered(artifactId)}
          onMouseLeave={() => setHovered(null)}
        >
          @{title}
        </span>
      );
    } else {
      parts.push(
        <span
          key={key++}
          className="line-through text-gray-500 px-1 rounded cursor-not-allowed"
          title="Deleted artifact"
        >
          @{title}
        </span>
      );
    }
    
    lastIndex = matchIndex + fullMatch.length;
  }
  
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts;
}

export default function ChatMessageComponent({ message, canvasNodes }: ChatMessageProps) {
  const { setHovered } = useHoverState();
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-700 text-gray-100'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {renderContentWithMentions(message.content, setHovered, canvasNodes)}
        </div>
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
          {time}
        </div>
      </div>
    </div>
  );
}
