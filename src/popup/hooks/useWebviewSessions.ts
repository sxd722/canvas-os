import { useState, useCallback } from 'react';
import type { WebviewSession, NavigationEntry, WebviewStatus } from '../../shared/types';

interface UseWebviewSessionsReturn {
  sessions: Map<string, WebviewSession>;
  createSession: (url: string, intent: string) => WebviewSession;
  getSession: (id: string) => WebviewSession | undefined;
  updateSession: (id: string, partial: Partial<WebviewSession>) => void;
  closeSession: (id: string) => void;
  incrementInteraction: (id: string) => boolean;
  pushNavigationEntry: (id: string, entry: NavigationEntry) => void;
  popNavigationEntry: (id: string) => NavigationEntry | undefined;
}

export function useWebviewSessions(): UseWebviewSessionsReturn {
  const [sessions, setSessions] = useState<Map<string, WebviewSession>>(new Map());

  const createSession = useCallback((url: string, intent: string): WebviewSession => {
    const id = `webview-${Date.now()}`;
    const nonce = crypto.randomUUID();
    const hostname = (() => {
      try { return new URL(url).hostname; } catch { return url; }
    })();

    const session: WebviewSession = {
      id,
      currentUrl: url,
      originalUrl: url,
      title: hostname,
      status: 'loading' as WebviewStatus,
      navigationHistory: [{
        url,
        title: hostname,
        timestamp: Date.now(),
        navigationType: 'initial'
      }],
      intent,
      interactionCount: 0,
      maxInteractions: 10,
      channelNonce: nonce,
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };

    setSessions(prev => {
      const updated = new Map(prev);
      updated.set(id, session);
      return updated;
    });

    return session;
  }, []);

  const getSession = useCallback((id: string): WebviewSession | undefined => {
    return sessions.get(id);
  }, [sessions]);

  const updateSession = useCallback((id: string, partial: Partial<WebviewSession>): void => {
    setSessions(prev => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const updated = new Map(prev);
      updated.set(id, { ...existing, ...partial, lastActiveAt: Date.now() });
      return updated;
    });
  }, []);

  const closeSession = useCallback((id: string): void => {
    setSessions(prev => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const updated = new Map(prev);
      updated.set(id, { ...existing, status: 'closed', lastActiveAt: Date.now() });
      return updated;
    });
  }, []);

  const incrementInteraction = useCallback((id: string): boolean => {
    let allowed = false;
    setSessions(prev => {
      const existing = prev.get(id);
      if (!existing) return prev;
      if (existing.interactionCount >= existing.maxInteractions) return prev;
      allowed = true;
      const updated = new Map(prev);
      updated.set(id, {
        ...existing,
        interactionCount: existing.interactionCount + 1,
        lastActiveAt: Date.now()
      });
      return updated;
    });
    return allowed;
  }, []);

  const pushNavigationEntry = useCallback((id: string, entry: NavigationEntry): void => {
    setSessions(prev => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const updated = new Map(prev);
      updated.set(id, {
        ...existing,
        navigationHistory: [...existing.navigationHistory, { ...entry, timestamp: Date.now() }],
        lastActiveAt: Date.now()
      });
      return updated;
    });
  }, []);

  const popNavigationEntry = useCallback((id: string): NavigationEntry | undefined => {
    let popped: NavigationEntry | undefined;
    setSessions(prev => {
      const existing = prev.get(id);
      if (!existing || existing.navigationHistory.length <= 1) return prev;
      const history = [...existing.navigationHistory];
      popped = history.pop();
      const updated = new Map(prev);
      updated.set(id, {
        ...existing,
        navigationHistory: history,
        lastActiveAt: Date.now()
      });
      return updated;
    });
    return popped;
  }, []);

  return {
    sessions,
    createSession,
    getSession,
    updateSession,
    closeSession,
    incrementInteraction,
    pushNavigationEntry,
    popNavigationEntry
  };
}
