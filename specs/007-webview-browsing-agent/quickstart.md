# Quickstart: Interactive Webview Browsing Agent

**Feature**: 007-webview-browsing-agent
**Date**: 2026-03-30

## Prerequisites

- CanvasOS extension built and loaded (`npm run build` + load unpacked)
- LLM provider configured (GLM, OpenAI, or Anthropic)
- Chrome launched with `--remote-debugging-port=9222`

## End-to-End Demo: MacBook Pro Price Comparison

### Step 1: Open the Extension

Click the CanvasOS extension icon. The split chat/canvas interface appears.

### Step 2: Ask the LLM to Compare Prices

Type in the chat:

```
Help me compare the price of MacBook Pro in Canada and China
```

### Step 3: Observe the Webview Nodes

The LLM will:
1. Call `browse_webview` for `https://www.apple.com/ca/mac/` with intent "find MacBook Pro prices"
2. Call `browse_webview` for `https://www.apple.com.cn/mac/` with intent "find MacBook Pro prices"
3. Two webview nodes appear on the canvas, each loading the respective Apple store

### Step 4: Watch the LLM Navigate

The LLM receives extracted interactive elements from each page:
- Links like "MacBook Pro", "Compare", pricing sections
- Each element has a relevance score based on the intent

The LLM decides which element to interact with:
```
interact_webview({
  session_id: "webview-123",
  element_selector: "a[href*='macbook-pro']",
  action: "click"
})
```

### Step 5: Observe the DAG

As the LLM works through the browsing workflow, a DAG appears on the canvas:

```
[apple.ca browse] → [Navigate to MBP page] → [Extract CAD price]
[apple.com.cn browse] → [Navigate to MBP page] → [Extract CNY price]
[Extract CAD price] + [Extract CNY price] → [Calculate HST] → [Convert CAD→CNY] → [Build table]
```

Each node turns green as the LLM completes that step.

### Step 6: Get the Result

The LLM builds a comparison table and presents it in the chat, using data extracted from both webviews without ever sending raw HTML through the API.

## Developer Quickstart

### Running Tests

```bash
# Unit tests
npm test

# CDP-based E2E test (requires Chrome on port 9222)
node test-tool-tester.cjs
```

### Testing the New Tools via CDP

```javascript
// Access tool tester via CDP
window.toolTester.invokeTool('browse_webview', {
  url: 'https://www.apple.com/ca/mac/',
  intent: 'find MacBook Pro prices',
  title: 'Apple Canada'
})

// Check active webview sessions
window.__webviewSessions

// Check canvas nodes (should include web-view nodes)
window.__canvasNodes
```

### Key Files to Modify

| File | What to Add |
|------|-------------|
| `manifest.json` | Add `content/webview_bridge.js` with `all_frames: true` |
| `src/shared/dagSchema.ts` | Add `webview-browse`, `webview-interact`, `webview-extract` to `DAGNodeType` |
| `src/shared/types.ts` | Add `WebviewSession`, `InteractiveElement`, `PageExtraction`, message types |
| `src/popup/services/toolRegistry.ts` | Add 4 new tool definitions and handlers |
| `src/popup/Canvas/EmbeddedWebView.tsx` | Add postMessage listener, session management, interaction dispatch |
| `src/popup/App.tsx` | Add webview session state, handle new tool calls in tool loop |
| `src/content/webview_bridge.js` | NEW: Content script for DOM extraction and interaction |
| `src/popup/services/semanticExtractor.ts` | NEW: TF-IDF scoring engine for element relevance |

### Architecture Overview

```
User Message → App.tsx (handleSendMessage)
  → LLM API (with tool definitions)
  → LLM responds with tool_calls
    → browse_webview / interact_webview / navigate_webview_back / extract_webview_content
      → toolRegistry.ts (executeTool)
        → EmbeddedWebView.tsx (iframe management)
          → postMessage → webview_bridge.js (content script in iframe)
            → DOM extraction / element interaction
          ← postMessage ← results
        ← PageExtraction result
      ← Tool result to conversation history
    → Next LLM iteration (may call more tools)
  → Final LLM response with comparison
```
