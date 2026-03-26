import { useHoverState } from '../context/HoverStateContext';

interface Artifact {
  id: string;
  title: string;
  type: string;
}

interface MentionDropdownProps {
  artifacts: Artifact[];
  selectedIndex: number;
  onSelect: (artifact: Artifact) => void;
  onClose?: () => void;
  position?: { top: number; left: number };
}

export default function MentionDropdown({
  artifacts,
  selectedIndex,
  onSelect,
  position
}: MentionDropdownProps) {
  const { setHovered } = useHoverState();

  if (artifacts.length === 0) {
    return (
      <div 
        className="absolute bg-gray-800 border border-gray-600 rounded shadow-lg p-2 text-sm text-gray-400 z-50"
        style={position ? { top: position.top, left: position.left } : { bottom: '100%', left: 0 }}
      >
        No artifacts found
      </div>
    );
  }

  return (
    <div 
      className="absolute bg-gray-800 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto z-50 min-w-[200px]"
      style={position ? { top: position.top, left: position.left } : { bottom: '100%', left: 0 }}
    >
      {artifacts.map((artifact, index) => (
        <div
          key={artifact.id}
          className={`px-3 py-2 cursor-pointer text-sm flex items-center gap-2 ${
            index === selectedIndex 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-200 hover:bg-gray-700'
          }`}
          onClick={() => onSelect(artifact)}
          onMouseEnter={() => setHovered(artifact.id)}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-600 text-gray-300">
            {artifact.type}
          </span>
          <span className="truncate">{artifact.title}</span>
        </div>
      ))}
    </div>
  );
}
