import { useState, useRef, useEffect, useCallback } from 'react';
import type { DAGNode, DAGPlan } from '../../shared/dagSchema';
import { registerDAGExecutionCallback } from '../services/toolRegistry';

type PlanUpdateCallback = (plan: DAGPlan) => void;

interface UseDagEngineReturn {
  plan: DAGPlan | null;
  nodes: DAGNode[];
  loading: boolean;
  error: string | null;
  subscribe: (callback: PlanUpdateCallback) => () => void;
}

export function useDagEngine(): UseDagEngineReturn {
  const [plans, setPlans] = useState<DAGPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscribersRef = useRef<Set<PlanUpdateCallback>>(new Set());

  useEffect(() => {
    const unsubscribe = registerDAGExecutionCallback((planId, nodes, status) => {
      setLoading(status === 'running');
      setError(null);
      
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
    subscribe
  };
}
