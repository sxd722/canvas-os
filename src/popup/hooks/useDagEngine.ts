import { useState, useCallback, useRef, useEffect } from 'react';
import type { DAGNode, DAGPlan } from '../../shared/dagSchema';
import { generateId } from '../../shared/types';
import { registerDAGExecutionCallback } from '../services/toolRegistry';

type PlanUpdateCallback = (plan: DAGPlan) => void;

interface UseDagEngineReturn {
  plan: DAGPlan | null;
  nodes: DAGNode[];
  loading: boolean;
  error: string | null;
  execute: (nodes: DAGNode[], triggeredBy: string, onUpdate?: PlanUpdateCallback) => Promise<DAGPlan>;
  cancel: (planId: string) => void;
  subscribe: (callback: PlanUpdateCallback) => () => void;
}

export function useDagEngine(): UseDagEngineReturn {
  const [plans, setPlans] = useState<DAGPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscribersRef = useRef<Set<PlanUpdateCallback>>(new Set());

  useEffect(() => {
    const unsubscribe = registerDAGExecutionCallback((planId, nodes, status) => {
      setPlans(prev => {
        const existing = prev.find(p => p.id === planId);
        if (existing) {
          return prev.map(p => 
            p.id === planId 
              ? { ...p, nodes, status: status === 'running' ? 'running' : status === 'completed' ? 'completed' : 'failed' }
              : p
          );
        }
        return [...prev, {
          id: planId,
          nodes,
          status: status === 'running' ? 'running' : status === 'completed' ? 'completed' : 'failed',
          createdAt: Date.now(),
          triggeredBy: 'external'
        }];
      });
    });
    return unsubscribe;
  }, []);

  const notifySubscribers = useCallback((plan: DAGPlan) => {
    subscribersRef.current.forEach(callback => callback(plan));
  }, []);

  const topologicalSort = useCallback((nodes: DAGNode[]): DAGNode[] => {
    const sorted: DAGNode[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (node: DAGNode) => {
      if (visited.has(node.id)) return;
      if (visiting.has(node.id)) {
        throw new Error(`Circular dependency detected involving node ${node.id}`);
      }

      visiting.add(node.id);

      for (const depId of node.dependencies) {
        const depNode = nodes.find(n => n.id === depId);
        if (depNode) {
          visit(depNode);
        }
      }

      visiting.delete(node.id);
      visited.add(node.id);
      sorted.push(node);
    };

    for (const node of nodes) {
      visit(node);
    }

    return sorted;
  }, []);

  const execute = useCallback(async (nodes: DAGNode[], triggeredBy: string, onUpdate?: PlanUpdateCallback): Promise<DAGPlan> => {
    setLoading(true);
    setError(null);

    try {
      const sortedNodes = topologicalSort(nodes);
      
      const plan: DAGPlan = {
        id: generateId(),
        nodes: sortedNodes.map(node => ({ ...node, status: 'pending' as const })),
        status: 'running',
        createdAt: Date.now(),
        triggeredBy
      };

      setPlans(prev => [...prev, plan]);
      notifySubscribers(plan);
      onUpdate?.(plan);

      const maxConcurrent = 4;
      const levels: DAGNode[][] = [];
      const processed = new Set<string>();

      while (processed.size < sortedNodes.length) {
        const level: DAGNode[] = [];
        
        for (const node of sortedNodes) {
          if (processed.has(node.id)) continue;
          
          const allDepsProcessed = node.dependencies.every(depId => processed.has(depId));
          
          if (allDepsProcessed) {
            level.push(node);
          }
        }

        if (level.length === 0) break;
        
        levels.push(level.slice(0, maxConcurrent));
        level.forEach(n => processed.add(n.id));
      }

      const nodeResults = new Map<string, unknown>();
      const failedNodes = new Set<string>();

      for (const level of levels) {
        await Promise.all(
          level.map(async (node) => {
            const updatePlan = (updater: (p: DAGPlan) => DAGPlan) => {
              setPlans(prev => {
                const updated = prev.map(p => {
                  if (p.id === plan.id) {
                    return updater(p);
                  }
                  return p;
                });
                const updatedPlan = updated.find(p => p.id === plan.id);
                if (updatedPlan) {
                  notifySubscribers(updatedPlan);
                  onUpdate?.(updatedPlan);
                }
                return updated;
              });
            };

            const hasFailedDependency = node.dependencies.some(depId => failedNodes.has(depId));
            if (hasFailedDependency) {
              failedNodes.add(node.id);
              updatePlan(p => ({
                ...p,
                nodes: p.nodes.map(n =>
                  n.id === node.id 
                    ? { 
                        ...n, 
                        status: 'skipped' as const, 
                        error: 'Skipped due to failed dependency',
                        completedAt: Date.now()
                      } 
                    : n
                )
              }));
              return;
            }

            updatePlan(p => ({
              ...p,
              nodes: p.nodes.map(n =>
                n.id === node.id ? { ...n, status: 'running' as const, startedAt: Date.now() } : n
              )
            }));

            try {
              const result = await executeNode(node, nodeResults);
              nodeResults.set(node.id, result);
              
              updatePlan(p => ({
                ...p,
                nodes: p.nodes.map(n =>
                  n.id === node.id 
                    ? { 
                        ...n, 
                        status: 'success' as const, 
                        result, 
                        completedAt: Date.now(),
                        artifactId: generateId()
                      } 
                    : n
                )
              }));
            } catch (err) {
              failedNodes.add(node.id);
              updatePlan(p => ({
                ...p,
                nodes: p.nodes.map(n =>
                  n.id === node.id 
                    ? { 
                      ...n, 
                      status: 'error' as const, 
                      error: err instanceof Error ? err.message : 'Unknown error',
                      completedAt: Date.now()
                    } 
                    : n
                )
              }));
            }
          })
        );
      }

      setPlans(prev => {
        const updated = prev.map(p => {
          if (p.id === plan.id) {
            return {
              ...p,
              status: 'completed' as const,
              completedAt: Date.now()
            };
          }
          return p;
        });
        const completedPlan = updated.find(p => p.id === plan.id);
        if (completedPlan) {
          notifySubscribers(completedPlan);
          onUpdate?.(completedPlan);
        }
        return updated;
      });

      setLoading(false);
      return plan;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, [topologicalSort, notifySubscribers]);

  const cancel = useCallback((planId: string) => {
    setPlans(prev => {
      const updated = prev.map(p => {
        if (p.id === planId) {
          return {
            ...p,
            status: 'cancelled' as const,
            completedAt: Date.now(),
            nodes: p.nodes.map(n => ({ ...n, status: 'skipped' as const }))
          };
        }
        return p;
      });
      const cancelledPlan = updated.find(p => p.id === planId);
      if (cancelledPlan) {
        notifySubscribers(cancelledPlan);
      }
      return updated;
    });
  }, [notifySubscribers]);

  const subscribe = useCallback((callback: PlanUpdateCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const currentPlan = plans.find(p => p.status === 'running') || plans[plans.length - 1] || null;

  return {
    plan: currentPlan,
    nodes: currentPlan?.nodes || [],
    loading,
    error,
    execute,
    cancel,
    subscribe
  };
}

async function executeNode(node: DAGNode, nodeResults: Map<string, unknown>): Promise<unknown> {
  const depResults: Record<string, unknown> = {};
  for (const depId of node.dependencies) {
    const result = nodeResults.get(depId);
    if (result !== undefined) {
      depResults[depId] = result;
    }
  }

  switch (node.type) {
    case 'llm-call': {
      const params = node.params as { prompt: string; model?: string };
      return {
        success: true,
        response: `LLM response for: ${params.prompt.substring(0, 50)}...`,
        model: params.model || 'default'
      };
    }
    case 'js-execution': {
      const params = node.params as { code: string; timeout?: number };
      try {
        const result = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), params.timeout || 5000);
          try {
            const fn = new Function('deps', params.code);
            resolve(fn(depResults));
            clearTimeout(timeout);
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });
        return { success: true, result };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Execution failed' 
        };
      }
    }
    case 'web-operation': {
      const params = node.params as { url: string; action: 'fetch' | 'screenshot' };
      if (params.action === 'fetch') {
        try {
          const response = await fetch(params.url);
          const contentType = response.headers.get('content-type') || '';
          const data = contentType.includes('json') ? await response.json() : await response.text();
          return { success: true, data, status: response.status };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Fetch failed' 
          };
        }
      }
      return { success: false, error: 'Screenshot not supported' };
    }
    default:
      throw new Error(`Unknown node type: ${(node as { type: string }).type}`);
  }
}
