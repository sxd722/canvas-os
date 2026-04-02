# Quickstart: Fix Iframe Targeting

**Branch**: `015-fix-iframe-targeting` | **Date**: 2026-04-01

## Overview

Fixes three iframe targeting bugs that cause webview extraction failures:
1. Session ID / canvas node ID mismatch in `postToIframe`
2. Fragile URL-based iframe lookup in `waitForExtraction`
3. Missing session-to-iframe DOM mapping

## Implementation Steps

### Step 1: Add `canvasNodeId` to `WebviewSession` type

**File**: `src/shared/types.ts`

Add optional `canvasNodeId?: string` to the `WebviewSession` interface.

### Step 2: Update `EmbeddedWebView` to render `data-session-id`

**File**: `src/popup/Canvas/EmbeddedWebView.tsx`

- Add `sessionId?: string` to `EmbeddedWebViewProps`
- Add `data-session-id={sessionId}` to the container div

### Step 3: Pass `sessionId` from `CanvasNode` to `EmbeddedWebView`

**File**: `src/popup/Canvas/CanvasNode.tsx`

- In the `web-view` case of `renderContent()`, read `sessionId` from node content
- Pass it to `EmbeddedWebView` as `sessionId` prop

### Step 4: Fix `postToIframe` to use `data-session-id`

**File**: `src/popup/services/toolRegistry.ts`

Change `postToIframe` from:
```javascript
document.querySelector(`[data-node-id="${sessionId}"]`)
```
To:
```javascript
document.querySelector(`[data-session-id="${sessionId}"]`)
```

### Step 5: Fix `waitForExtraction` to use session-ID-based lookup

**File**: `src/popup/services/toolRegistry.ts`

Replace the URL-based retry loop with a single session-ID-based lookup:
```javascript
const container = document.querySelector(`[data-session-id="${sessionId}"]`);
const iframe = container?.querySelector('iframe');
```

### Step 6: Wire `canvasNodeId` in scrape and browse handlers

**File**: `src/popup/services/toolRegistry.ts`

- In `browse_webview` handler: set `canvasNodeId` on the session when created from a scrape flow
- In `scrape` node handler: update canvas node content to include `sessionId` after session creation
- Use `addCanvasNode` callback or a new `updateCanvasNode` mechanism to set `sessionId` on the canvas node content

## Testing

### Manual Test (via CDP)
```javascript
// 1. Create a DAG with a scrape node
window.toolTester.invokeTool('execute_dag', {
  nodes: [{
    id: 'test-scrape',
    type: 'scrape',
    params: { url: 'https://example.com' },
    dependencies: []
  }]
})

// 2. Verify extraction succeeds without timeout
// 3. Check console for [ToolRegistry] logs showing session-ID-based lookup
```

### Build Verification
```bash
npm run build && npm run lint
```

## Files Changed

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `canvasNodeId` to `WebviewSession` |
| `src/popup/Canvas/EmbeddedWebView.tsx` | Add `sessionId` prop, render `data-session-id` |
| `src/popup/Canvas/CanvasNode.tsx` | Pass `sessionId` from content to `EmbeddedWebView` |
| `src/popup/services/toolRegistry.ts` | Fix `postToIframe`, `waitForExtraction`, wire `canvasNodeId` |
