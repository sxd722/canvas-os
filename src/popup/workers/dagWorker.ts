import type { DAGNode, DAGNodeParams } from '../../shared/dagSchema';
import type { LLMConfig } from '../../shared/types';

export type WorkerMessage = {
  type: 'execute';
  nodeId: string;
  nodeType: DAGNode['type'];
  params: DAGNodeParams;
  config?: LLMConfig;
  dependencyResults?: Record<string, unknown>;
};

export type WorkerResponse = {
  type: 'result' | 'error';
  nodeId: string;
  result?: unknown;
  error?: string;
  executionTime?: number;
};

export type WorkerStatus = 'idle' | 'busy' | 'error';

export class DagWorkerManager {
  private workers: Map<string, Worker> = new Map();
  private activeExecutions: Map<string, { resolve: (result: WorkerResponse) => void }> = new Map();
  private workerStatus: Map<string, WorkerStatus> = new Map();

  createWorker(workerId: string, workerScript: string): Worker {
    const worker = new Worker(workerScript, { type: 'module' });
    
    worker.onmessage = (event: MessageEvent) => {
      const response = event.data as WorkerResponse;
      const execution = this.activeExecutions.get(response.nodeId);
      if (execution) {
        execution.resolve(response);
        this.activeExecutions.delete(response.nodeId);
      }
      this.workerStatus.set(workerId, 'idle');
    };

    worker.onerror = (error: ErrorEvent) => {
      console.error(`Worker ${workerId} error:`, error);
      this.workerStatus.set(workerId, 'error');
    };

    this.workers.set(workerId, worker);
    this.workerStatus.set(workerId, 'idle');
    return worker;
  }

  async executeNode(
    workerId: string,
    message: WorkerMessage
  ): Promise<WorkerResponse> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return {
        type: 'error',
        nodeId: message.nodeId,
        error: `Worker ${workerId} not found`
      };
    }

    if (this.workerStatus.get(workerId) === 'busy') {
      return {
        type: 'error',
        nodeId: message.nodeId,
        error: `Worker ${workerId} is busy`
      };
    }

    return new Promise((resolve) => {
      this.activeExecutions.set(message.nodeId, { resolve });
      this.workerStatus.set(workerId, 'busy');
      worker.postMessage(message);
    });
  }

  terminateWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.terminate();
      this.workers.delete(workerId);
      this.workerStatus.delete(workerId);
    }
  }

  terminateAll(): void {
    for (const [workerId] of this.workers) {
      this.terminateWorker(workerId);
    }
  }

  getWorkerStatus(workerId: string): WorkerStatus {
    return this.workerStatus.get(workerId) || 'idle';
  }

  getActiveCount(): number {
    let count = 0;
    for (const status of this.workerStatus.values()) {
      if (status === 'busy') count++;
    }
    return count;
  }
}

export const dagWorkerManager = new DagWorkerManager();
