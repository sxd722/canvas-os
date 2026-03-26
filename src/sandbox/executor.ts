interface ExecuteMessage {
  type: 'SANDBOX_EXECUTE';
  code: string;
  timeout: number;
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

function executeCode(code: string): { result?: unknown; error?: string; duration: number } {
  const startTime = performance.now();
  
  try {
    const val = (codeToRun: string) => {
      try {
        const fn = new Function(`return (${codeToRun})`);
        return fn();
      } catch {
        const fn = new Function(codeToRun);
        return fn();
      }
    };
    
    const result = val(code);
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
  
  const { code, timeout } = event.data;
  
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
    const executionResult = executeCode(code);
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
