interface ExecuteMessage {
  type: 'SANDBOX_EXECUTE';
  code: string;
  timeout: number;
  deps?: Record<string, unknown>;
}

interface ResultMessage {
  type: 'SANDBOX_RESULT';
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_, v) => {
      if (typeof v === 'function') return '[Function]';
      if (typeof v === 'symbol') return '[Symbol]';
      if (typeof v === 'bigint') return v.toString();
      return v;
    });
  } catch {
    return String(value);
  }
}

function executeCode(code: string, deps?: Record<string, unknown>): { result?: unknown; error?: string; duration: number } {
  const startTime = performance.now();
  
  try {
    const val = (codeToRun: string, dependencies?: Record<string, unknown>) => {
      try {
        const depKeys = dependencies ? Object.keys(dependencies) : [];
        const depValues = dependencies ? Object.values(dependencies) : [];
        const fn = new Function('deps', ...depKeys, `return (${codeToRun})`);
        return fn(dependencies, ...depValues);
      } catch {
        const depKeys = dependencies ? Object.keys(dependencies) : [];
        const depValues = dependencies ? Object.values(dependencies) : [];
        const fn = new Function('deps', ...depKeys, codeToRun);
        return fn(dependencies, ...depValues);
      }
    };
    
    const result = val(code, deps);
    const duration = performance.now() - startTime;
    
    return { result, duration };
  } catch (error) {
    const duration = performance.now() - startTime;
    return { 
      error: error instanceof Error ? error.message : String(error), 
      duration 
    };
  }
}

window.addEventListener('message', (event: MessageEvent<ExecuteMessage>) => {
  if (event.data?.type !== 'SANDBOX_EXECUTE') return;
  
  const { code, timeout, deps } = event.data;
  
  const timeoutId = setTimeout(() => {
    const result: ResultMessage = {
      type: 'SANDBOX_RESULT',
      success: false,
      error: 'Execution timeout',
      duration: timeout
    };
    window.parent.postMessage(result, '*');
  }, timeout);

  try {
    const executionResult = executeCode(code, deps);
    clearTimeout(timeoutId);
    
    const result: ResultMessage = {
      type: 'SANDBOX_RESULT',
      success: !executionResult.error,
      result: executionResult.result,
      error: executionResult.error,
      duration: executionResult.duration
    };
    
    window.parent.postMessage(result, '*');
  } catch (error) {
    clearTimeout(timeoutId);
    
    const result: ResultMessage = {
      type: 'SANDBOX_RESULT',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: 0
    };
    
    window.parent.postMessage(result, '*');
  }
});

window.parent.postMessage({ type: 'SANDBOX_READY' }, '*');
