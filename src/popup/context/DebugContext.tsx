import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface DebugLogEntry {
  id: string;
  type: 'llm-request' | 'tool-call' | 'dag-execution';
  timestamp: number;
  request: unknown;
  response?: unknown;
  status: 'pending' | 'success' | 'error';
  error?: string;
  duration?: number;
}

interface DebugContextType {
  logs: DebugLogEntry[];
  isEnabled: boolean;
  addLog: (entry: Omit<DebugLogEntry, 'id' | 'timestamp'>) => string;
  updateLog: (id: string, updates: Partial<DebugLogEntry>) => void;
  clearLogs: () => void;
  toggleEnabled: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export function DebugProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);

  const addLog = useCallback((entry: Omit<DebugLogEntry, 'id' | 'timestamp'>): string => {
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newLog: DebugLogEntry = {
      ...entry,
      id,
      timestamp: Date.now()
    };
    setLogs(prev => [...prev, newLog]);
    return id;
  }, []);

  const updateLog = useCallback((id: string, updates: Partial<DebugLogEntry>) => {
    setLogs(prev => prev.map(log => 
      log.id === id ? { ...log, ...updates } : log
    ));
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  return (
    <DebugContext.Provider value={{ logs, isEnabled, addLog, updateLog, clearLogs, toggleEnabled }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug(): DebugContextType {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within DebugProvider');
  }
  return context;
}
