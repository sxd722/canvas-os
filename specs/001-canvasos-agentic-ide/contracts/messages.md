# Message Contracts: CanvasOS Agentic IDE

**Feature Branch**: `001-canvasos-agentic-ide`
**Date**: 2026-03-24

## Overview

This document defines the message contracts for inter-component communication in CanvasOS.

## Message Types

### 1. Sandbox Messages (postMessage)

Communication between the main popup and the sandboxed iframe.

#### EXECUTE Request

**Direction**: Main thread → Sandbox iframe

```typescript
interface ExecuteMessage {
  type: 'EXECUTE';
  payload: {
    code: string;        // JavaScript code to execute
    timeout: number;     // Max execution time in ms (default: 10000)
    context?: object;    // Optional context variables to inject
  };
}
```

#### RESULT Response

**Direction**: Sandbox iframe → Main thread

```typescript
interface ResultMessage {
  type: 'RESULT';
  payload: {
    success: boolean;
    result?: unknown;   // Return value if successful
    error?: string;     // Error message if failed
    duration: number;   // Execution time in ms
  };
}
```

#### ERROR Response

**Direction**: Sandbox iframe → Main thread

```typescript
interface ErrorMessage {
  type: 'ERROR';
  payload: {
    code: string;       // Original code that failed
    error: string;      // Error message
    stack?: string;     // Stack trace if available
  };
}
```

### 2. Extension Messages (chrome.runtime)

Communication between popup, background service worker, and content scripts.

#### RESEARCH_URL Action

**Direction**: Popup → Background → Content Script

```typescript
interface ResearchUrlMessage {
  action: 'RESEARCH_URL';
  data: {
    url: string;
    requestId: string;
  };
}
```

#### SCRAPE_RESULT Action

**Direction**: Content Script → Background

```typescript
interface ScrapeResultMessage {
  action: 'SCRAPE_RESULT';
  data: {
    requestId: string;
    success: boolean;
    content?: string;    // Scraped text content
    error?: string;
  };
}
```

#### CREATE_CANVAS_NODE Action

**Direction**: Background → Popup

```typescript
interface CreateCanvasNodeMessage {
  action: 'CREATE_CANVAS_NODE';
  data: {
    node: CanvasNode;
  };
}
```

#### UPDATE_CHAT Action

**Direction**: Popup → Popup (internal state)

```typescript
interface UpdateChatMessage {
  action: 'UPDATE_CHAT';
  data: {
    messages: ChatMessage[];
  };
}
```

### 3. LLM Integration Messages

Communication between popup and LLM API.

#### LLM_REQUEST

**Direction**: Popup → LLM API (external)

```typescript
interface LLMRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  config: {
    provider: 'openai' | 'anthropic' | 'custom';
    apiKey: string;
    endpoint?: string;
    model: string;
  };
}
```

#### LLM_RESPONSE

**Direction**: LLM API → Popup (external)

```typescript
interface LLMResponse {
  success: boolean;
  content?: string;      // Response text
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}
```

## Security Requirements

### postMessage Validation

All `postMessage` handlers MUST validate:

1. **Origin Check**: Verify `event.origin` matches expected origin
2. **Structure Validation**: Validate message has required `type` and `payload` fields
3. **Payload Validation**: Validate payload fields match expected types

```typescript
// Example validation in sandbox.html
window.addEventListener('message', (event) => {
  // Only accept messages from same origin (extension)
  if (event.origin !== window.location.origin) {
    console.warn('Rejected message from unknown origin:', event.origin);
    return;
  }
  
  const { type, payload } = event.data;
  if (!type || !payload) {
    console.warn('Invalid message structure');
    return;
  }
  
  // Process validated message...
});
```

### chrome.runtime.sendMessage Validation

All extension messages MUST include:
- `action` field with known value
- Proper `data` structure for the action type

## Message Flow Diagrams

### Research URL Flow

```
User types "Research [URL]"
        ↓
Popup detects pattern → chrome.runtime.sendMessage({ action: 'RESEARCH_URL', data: { url, requestId } })
        ↓
Background receives message → Creates tab with URL
        ↓
Background injects content script → chrome.scripting.executeScript({ target: { tabId }, func: scraper })
        ↓
Scraper extracts content → chrome.runtime.sendMessage({ action: 'SCRAPE_RESULT', data: { requestId, content } })
        ↓
Background receives result → Closes tab → chrome.runtime.sendMessage({ action: 'CREATE_CANVAS_NODE', data: { node } })
        ↓
Popup receives node → Adds to canvas state
```

### Sandbox Execution Flow

```
LLM generates code → Popup sends to sandbox
        ↓
Popup → iframe.contentWindow.postMessage({ type: 'EXECUTE', payload: { code, timeout } }, '*')
        ↓
Sandbox receives → Executes code in isolated context
        ↓
Sandbox → window.parent.postMessage({ type: 'RESULT', payload: { result, duration } }, '*')
        ↓
Popup receives → Displays result or creates canvas node
```
