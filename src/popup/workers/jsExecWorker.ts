import type { JSExecutionParams } from '../../shared/dagSchema';

interface JSExecMessage {
  type: 'execute';
  nodeId: string;
  params: JSExecutionParams;
}

interface JSExecResult {
  nodeId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime?: number;
}

self.onmessage = async (event: MessageEvent) => {
  const message = event.data as JSExecMessage;
  const { nodeId, params } = message;
  const timeout = params.timeout || 5000;
  const startTime = Date.now();
  
  try {
    const result = await executeInSandbox(params.code, timeout);
    const execTime = Date.now() - startTime;
    
    const response: JSExecResult = {
      nodeId,
      success: true,
      result: result,
      executionTime: execTime
    };
    self.postMessage(response);
  } catch (error) {
    const execTime = Date.now() - startTime;
    const response: JSExecResult = {
      nodeId,
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
      executionTime: execTime
    };
    self.postMessage(response);
  }
};

function executeInSandbox(code: string, timeout: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Execution timeout'));
    }, timeout);
    
    try {
      const wrappedCode = `
        (function() {
          'use strict';
          ${code}
        })()
      `;
      
      const result = eval(wrappedCode);
      
      clearTimeout(timeoutId);
      
      if (result instanceof Promise) {
        result
          .then(r => {
            clearTimeout(timeoutId);
            resolve(r);
          })
          .catch(e => {
            clearTimeout(timeoutId);
            reject(e);
          });
        
        setTimeout(() => {
          clearTimeout(timeoutId);
          reject(new Error('Promise timeout'));
        }, timeout);
      } else {
        resolve(result);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

export {};
