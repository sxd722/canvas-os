# Data Model: Fix Iframe Targeting

**Branch**: `015-fix-iframe-targeting` | **Date**: 2026-04-01

## Entity Changes

### 1. WebviewSession (modified)

**File**: `src/shared/types.ts`

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `canvasNodeId` | `string \| undefined` | ADDED | ID of the canvas node that contains this session's iframe. Set when a scrape/browse handler creates the canvas node. Enables reverse lookup from session to iframe container. |

**Validation Rules**:
- `canvasNodeId` is optional — standalone `browse_webview` calls may not have a canvas node
- When set, must match an existing canvas node ID
- Must be set synchronously when the session is created from a scrape node

**State Transitions**:
- Not applicable — `canvasNodeId` is set once at session creation and never changes

### 2. CanvasNode.content (web-view type — modified)

**File**: `src/shared/types.ts` (implicitly via CanvasNode)

The `content` field of web-view canvas nodes gains an optional `sessionId` field:

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `content.sessionId` | `string \| undefined` | ADDED | The webview session ID associated with this iframe. Set when `browse_webview` creates a session for this canvas node. |

**Validation Rules**:
- Optional — web-view nodes created by `open_web_view` (non-DAG) may not have a session ID
- When set, must match a valid webview session ID

### 3. EmbeddedWebViewProps (modified)

**File**: `src/popup/Canvas/EmbeddedWebView.tsx`

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `sessionId` | `string \| undefined` | ADDED | Webview session ID, rendered as `data-session-id` on the container div |

## Relationships

```
CanvasNode (web-view type)
  └── content.sessionId ──→ WebviewSession.id
  └── EmbeddedWebView component
        └── data-session-id attribute (for DOM queries)
        └── data-node-id attribute (existing, for canvas positioning)

WebviewSession
  └── canvasNodeId ──→ CanvasNode.id
  └── channelNonce ──→ nonce used in postMessage communication
```

## DOM Targeting Flow (After Fix)

```
1. Scrape handler creates CanvasNode with id="dag-node-X"
2. browse_webview creates WebviewSession with id="wv-Y", canvasNodeId="dag-node-X"
3. CanvasNode renders EmbeddedWebView with sessionId="wv-Y"
4. EmbeddedWebView renders: <div data-node-id="dag-node-X" data-session-id="wv-Y">
5. postToIframe("wv-Y") queries: [data-session-id="wv-Y"] iframe ✓
6. waitForExtraction queries: [data-session-id="wv-Y"] iframe ✓
```

## Migration Notes

- **Backward compatible**: New fields are optional; existing canvas nodes without `sessionId` still work
- **No storage migration**: WebviewSessions are in-memory only (React state); no persisted data to migrate
- **No manifest changes**: No new permissions or content script changes needed
