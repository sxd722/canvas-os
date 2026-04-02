# Data Model: Fix Iframe Targeting ID Mismatch

**Feature**: 017-fix-iframe-id-mismatch
**Date**: 2026-04-02

## Entity Changes

### Modified: Tool Call Arguments (browse_webview)

The `browse_webview` tool call gains a new optional argument.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `canvasNodeId` | `string` | No | The canvas node ID of the web-view node created before calling browse_webview. Used to locate the iframe container in the DOM. |

### Modified: postToIframe Signature

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | `string` | Yes | Webview session ID (for logging) |
| `message` | `Record<string, unknown>` | Yes | Message to post to the iframe |
| `canvasNodeId` | `string` | No | Canvas node ID for DOM lookup. Primary lookup key when provided. |

### Modified: waitForExtraction Signature

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nonce` | `string` | Yes | Channel nonce for response matching |
| `sessionId` | `string` | Yes | Webview session ID |
| `intent` | `string` | Yes | Extraction intent |
| `timeoutMs` | `number` | Yes | Timeout in milliseconds |
| `url` | `string` | Yes | Page URL (used in error result) |
| `canvasNodeId` | `string` | No | Canvas node ID for DOM lookup. |

### Modified: sendInteractionToIframe Signature

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | `string` | Yes | Webview session ID |
| `nonce` | `string` | Yes | Interaction nonce |
| `selector` | `string` | Yes | CSS selector for target element |
| `action` | `'click' \| 'fill' \| 'select'` | Yes | Interaction type |
| `value` | `string` | No | Value for fill/select actions |
| `canvasNodeId` | `string` | No | Canvas node ID for DOM lookup. |

### Modified: sendExtractBySelector Signature

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | `string` | Yes | Webview session ID |
| `nonce` | `string` | Yes | Extraction nonce |
| `selector` | `string` | Yes | CSS selector for target elements |
| `canvasNodeId` | `string` | No | Canvas node ID for DOM lookup. |

## State Flow

```text
Scrape Path:
  scrape handler → canvasNodeId = `dag-node-${node.id}`
    → addCanvasNode({ id: canvasNodeId, ... })
    → executeTool('browse_webview', { ..., canvasNodeId })
      → browse_webview handler extracts canvasNodeId from args
      → waitForExtraction(nonce, sessionId, intent, timeout, url, canvasNodeId)
        → tryFindAndSend: query [data-node-id="${canvasNodeId}"]
        → fallback: postToIframe(sessionId, msg, canvasNodeId)

Direct Browse Path (App.tsx):
  handleToolCall → nodeId = generateId()
    → webViewNode = { id: nodeId, ... }
    → toolCall.arguments.canvasNodeId = nodeId
    → executeTool(toolCall)
      → browse_webview handler extracts canvasNodeId from args
      → waitForExtraction(nonce, sessionId, intent, timeout, url, canvasNodeId)
        → tryFindAndSend: query [data-node-id="${canvasNodeId}"]
        → fallback: postToIframe(sessionId, msg, canvasNodeId)

Backward-Compatible Path (no canvasNodeId):
  postToIframe(sessionId, msg)
    → query [data-session-id="${sessionId}"]  (existing behavior)
```

## Validation Rules

- `canvasNodeId` is optional on all interfaces — backward compatibility must be maintained
- When `canvasNodeId` is provided, it MUST match an existing `data-node-id` attribute in the DOM
- When `canvasNodeId` is absent, the system falls back to `sessionId` for DOM lookup
