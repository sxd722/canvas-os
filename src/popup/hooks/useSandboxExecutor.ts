import { useCallback, useRef } from 'react';
import type { SandboxResultMessage } from '../../shared/messages';

export function useSandboxExecutor(sandboxRef: React.RefObject<HTMLIFrameElement | null>) {
  const pendingExecutions = useRef<Map<string, {
    resolve: (result: { result?: unknown; error?: string; duration: number }) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>>(new Map());

  const executeInSandbox = useCallback((code: string, timeout: number = 10000, deps?: Record<string, unknown>): Promise<{
    result?: unknown;
    error?: string;
    duration: number;
  }> => {
    return new Promise((resolve) => {
      const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const timeoutId = setTimeout(() => {
        pendingExecutions.current.delete(executionId);
        resolve({ error: 'Execution timeout', duration: timeout });
      }, timeout);

      pendingExecutions.current.set(executionId, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          pendingExecutions.current.delete(executionId);
          resolve(result);
        },
        timeout: timeoutId
      });

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        const data = event.data as SandboxResultMessage;
        if (data?.type === 'SANDBOX_RESULT' && pendingExecutions.current.has(executionId)) {
          window.removeEventListener('message', handleMessage);
          const pending = pendingExecutions.current.get(executionId);
          pending?.resolve({
            result: data.result,
            error: data.error,
            duration: data.duration
          });
        }
      };

      window.addEventListener('message', handleMessage);

      if (sandboxRef.current?.contentWindow) {
        sandboxRef.current.contentWindow.postMessage({
          type: 'SANDBOX_EXECUTE',
          code,
          timeout,
          deps
        }, '*');
      } else {
        window.removeEventListener('message', handleMessage);
        pendingExecutions.current.delete(executionId);
        resolve({ error: 'Sandbox not available', duration: 0 });
      }
    });
  }, [sandboxRef]);

  return { executeInSandbox };
}
