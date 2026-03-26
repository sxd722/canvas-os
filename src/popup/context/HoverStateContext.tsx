import React, { createContext, useContext, useState, ReactNode } from 'react';

interface HoverState {
  hoveredNodeId: string | null;
  setHovered: (id: string | null) => void;
}

const HoverStateContext = createContext<HoverState>({
  hoveredNodeId: null,
  setHovered: () => {},
});

export const HoverStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const setHovered = (id: string | null) => {
    setHoveredNodeId(id);
  };

  return (
    <HoverStateContext.Provider value={{ hoveredNodeId, setHovered }}>
      {children}
    </HoverStateContext.Provider>
  );
};

export const useHoverState = () => {
  const context = useContext(HoverStateContext);
  if (!context) {
    throw new Error('useHoverState must be used within HoverStateProvider');
  }
  return context;
};
