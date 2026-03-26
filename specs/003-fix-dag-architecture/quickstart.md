# Quickstart: Fix DAG Architecture & MV3 CSP Violations

**Feature Branch**: `003-fix-dag-architecture`
**Date**: 2026-03-26

## Prerequisites
- Node.js 18+
- Chrome browser with Remote Debugging enabled
- Existing CanvasOS extension loaded

## Testing the Fixes
### 1. Test Consolidated Execution Engine
```javascript
// In browser console on extension page:
// Trigger a DAG execution via chat
window.toolTester.invokeTool('execute_dag', {
  nodes: [
    { id: 'test-1', type: 'llm-call', params: { prompt: 'Hello' }, dependencies: [] }
  ]
});

// Verify in console that toolRegistry.executeTool was called
// (add console.log in toolRegistry to verify)
```

### 2. Test Sandbox Execution
```javascript
// Test js-execution via sandbox
window.toolTester.invokeTool('execute_dag', {
  nodes: [
    { 
      id: 'js-test', 
      type: 'js-execution', 
      params: { 
        code: 'return 1 + 1',
        timeout: 5000
      }, 
      dependencies: [] 
    }
  ]
});

// Verify no CSP errors in console
// Verify result is { success: true, result: 2 }
```

### 3. Test Real LLM Calls
```javascript
// Configure LLM first in Settings
// Then test:
window.toolTester.invokeTool('execute_dag', {
  nodes: [
    { 
      id: 'llm-test', 
      type: 'llm-call', 
      params: { 
        prompt: 'Say hello in one word'
      }, 
      dependencies: [] 
    }
  ]
});

// Verify actual LLM response (not mock)
```

### 4. Test CORS Bypass
```javascript
// Test web-operation through background
window.toolTester.invokeTool('execute_dag', {
  nodes: [
    { 
      id: 'fetch-test', 
      type: 'web-operation', 
      params: { 
        url: 'https://api.github.com/zen',
        action: 'fetch'
      }, 
      dependencies: [] 
    }
  ]
});

// Verify fetch succeeds (bypasses CORS)
```

### 5. Test Dependency Interpolation
```javascript
// Test parent -> child interpolation
window.toolTester.invokeTool('execute_dag', {
  nodes: [
    { 
      id: 'parent', 
      type: 'js-execution', 
      params: { code: 'return { data: 42 }' }, 
      dependencies: [] 
    },
    { 
      id: 'child', 
      type: 'js-execution', 
      params: { 
        code: 'return deps.parent.data * 2',
        deps: { parent: '$parent' }  // Reference to parent
      }, 
      dependencies: ['parent'] 
    }
  ]
});

// Verify child receives parent result and returns 84
```

## Development Commands
```bash
# Run linting
npm run lint

# Run type checking
npx tsc --noEmit

# Build for production
npm run build

# Test via CDP
node test-tool-tester.cjs
```

## Debug via Chrome DevTools
1. Open Chrome with remote debugging: `chrome.exe --remote-debugging-port=9222`
2. Load extension from `dist/` folder
3. Open DevTools and test via `window.toolTester`
4. Monitor console for CSP violations

## Key Files to Modify
| File | Change |
|------|--------|
| src/popup/App.tsx | Remove direct useDagEngine.execute() call |
| src/popup/services/toolRegistry.ts | Add sandbox execution, dependency interpolation |
| src/popup/hooks/useDagEngine.ts | Convert to pure UI state manager |
| src/sandbox/executor.ts | Add deps parameter support |
| src/popup/hooks/useSandboxExecutor.ts | Support passing deps |
| src/popup/workers/jsExecWorker.ts | DELETE (use sandbox instead) |

## Architecture After Fix
```
App.tsx (UI Layer)
    │
    └── toolRegistry.executeTool() (Tool Layer)
            │
            ├── llmCallWorker (LLM calls)
            ├── background/DAG_FETCH (Web ops)
            └── sandbox.html (JS execution)
                    │
                    └── useDagEngine (subscribes to updates)
```
