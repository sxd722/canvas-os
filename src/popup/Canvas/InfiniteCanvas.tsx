import React from 'react';

interface InfiniteCanvasProps {
  offset: { x: number; y: number };
  scale: number;
  children: React.ReactNode;
}

export default function InfiniteCanvas({ offset, scale, children }: InfiniteCanvasProps) {
  return (
    <div
      className="relative w-full h-full"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: '0 0'
      }}
    >
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          transform: `scale(${1/scale})`,
          transformOrigin: '0 0'
        }}
      />
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
