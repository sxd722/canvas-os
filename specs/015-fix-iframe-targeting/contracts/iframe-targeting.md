# Contract: Iframe Targeting (Internal)

**Branch**: `015-fix-iframe-targeting` | **Date**: 2026-04-01

This contract defines the internal interface between the ToolRegistry and the EmbeddedWebView component for reliable iframe targeting.

## DOM Contract

### Container Attributes

The `EmbeddedWebView` container div MUST render:

```html
<div data-node-id="{nodeId}" data-session-id="{sessionId}">
  <iframe src="{url}" ... />
</div>
```

| Attribute | Source | Used By |
|-----------|--------|---------|
| `data-node-id` | `EmbeddedWebViewProps.nodeId` | Canvas positioning, existing functionality |
| `data-session-id` | `EmbeddedWebViewProps.sessionId` | `postToIframe()`, `waitForExtraction()` |

### Lookup Methods

#### `postToIframe(sessionId: string, message: Record<string, unknown>): void`

```
Input:  sessionId (WebviewSession.id), message (postMessage payload)
Lookup: document.querySelector(`[data-session-id="${sessionId}"]`)
Target: container.querySelector('iframe')?.contentWindow
Output: iframe.contentWindow.postMessage(message, '*')
```

**Behavior**: Finds the iframe container by session ID, then posts the message to its iframe's contentWindow. Logs warning if container or iframe not found.

#### `waitForExtraction(nonce, sessionId, intent, timeoutMs, url): Promise<PageExtraction>`

```
Primary lookup:  document.querySelector(`[data-session-id="${sessionId}"] iframe`)
Fallback lookup: [removed] URL-based matching removed
Message:         iframe.contentWindow.postMessage({ type: 'EXTRACT_CONTENT', nonce, intent, sessionId }, '*')
```

**Behavior**: Finds iframe by session ID, sends `EXTRACT_CONTENT`, waits for `CONTENT_RESPONSE` or `EXTRACTION_RESULT`. No retries needed since session ID lookup is deterministic.

## Component Props Contract

### EmbeddedWebViewProps (extended)

```typescript
interface EmbeddedWebViewProps {
  url: string;
  title?: string;
  nodeId: string;              // Canvas node ID (existing)
  sessionId?: string;           // Webview session ID (NEW)
  channelNonce?: string;        // Communication nonce (existing, now actually used)
  onStatusChange?: (status: WebViewStatus) => void;
  onExtraction?: (extraction: PageExtraction) => void;
  onInteractionResult?: (result: { success: boolean; newUrl?: string; navigated: boolean }) => void;
}
```

## Session Creation Contract

### When `browse_webview` creates a session from a scrape node:

1. Scrape handler creates canvas node with known ID
2. `browse_webview` creates session with `canvasNodeId` = canvas node ID
3. ToolRegistry updates canvas node content to include `sessionId`
4. EmbeddedWebView receives `sessionId` via canvas node content
5. EmbeddedWebView renders `data-session-id` on container

### State flow:

```
scrape handler → addCanvasNode({ id: "dag-node-X", content: { url, title } })
                 ↓
browse_webview → session = createSession(url, intent)
              → session.canvasNodeId = "dag-node-X"
              → update canvas node content: { ..., sessionId: session.id }
                 ↓
React re-render → CanvasNode reads content.sessionId
               → EmbeddedWebView receives sessionId={content.sessionId}
               → DOM: <div data-session-id="wv-Y">
```

## Backward Compatibility

- Canvas nodes without `sessionId` in content → `data-session-id` not rendered → `postToIframe` logs warning (existing behavior for non-session iframes)
- `open_web_view` tool → no session created → no `data-session-id` → works as before
- Existing `data-node-id` remains unchanged for canvas-level operations
