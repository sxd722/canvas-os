# Research: Fix Iframe Targeting

**Branch**: `015-fix-iframe-targeting` | **Date**: 2026-04-01

## Research Task 1: Session ID / Canvas Node ID Mismatch

### Problem
`postToIframe(sessionId)` in `toolRegistry.ts:1162-1174` searches for `[data-node-id="${sessionId}"]`, but the iframe container's `data-node-id` attribute is set by `EmbeddedWebView` to the `nodeId` prop, which is the canvas node ID (e.g., `dag-node-scrapeNode1`). The session ID (e.g., `wv-1743500000-abc123`) is generated independently by the webview session manager.

### Root Cause Analysis
In the scrape flow:
1. `executeNodeWithWorker` creates a canvas node with ID `dag-node-${node.id}` (toolRegistry.ts:868)
2. `CanvasNode.tsx:199-204` renders `EmbeddedWebView` with `nodeId={node.id}` (the canvas node ID)
3. `EmbeddedWebView.tsx:160` sets `data-node-id={nodeId}` (the canvas node ID)
4. `browse_webview` creates a session with a different ID via `this.webviewSessions.createSession()` (toolRegistry.ts:419)
5. `postToIframe(sessionId)` searches for `[data-node-id="${sessionId}"]` — **mismatch**

### Decision
Add a `data-session-id` attribute to the iframe container, set when the session is created. Add a `canvasNodeId` field to `WebviewSession` to map back from session to canvas node. Update `postToIframe` to search by `data-session-id` instead of `data-node-id`.

### Rationale
- `data-session-id` is unambiguous — one session per iframe
- The session ID is already the primary key for all webview operations (interact, extract, navigate_back)
- Backward compatible — `data-node-id` remains for canvas-level operations

### Alternatives Considered
1. **Use canvas node ID as session ID**: Would require changing session creation flow; session IDs have different format expectations
2. **Maintain a Map<sessionId, canvasNodeId>**: Works but requires cleanup when sessions close; DOM attribute is self-documenting
3. **Search all iframes and check nonce**: Unreliable; nonce may not be set yet at lookup time

---

## Research Task 2: Fragile URL-Based Iframe Lookup

### Problem
`waitForExtraction` in `toolRegistry.ts:1253-1268` finds iframes via `document.querySelector<HTMLIFrameElement>(`iframe[src="${url}"]`)`. This fails when:
- URL redirects change the actual iframe `src` (e.g., `http://` → `https://`)
- URL encoding differs (e.g., `%20` vs `+` vs space)
- Multiple iframes load the same or similar URLs concurrently

### Root Cause Analysis
The URL-based lookup was the original approach before `postToIframe` existed. It's used as the primary method in `waitForExtraction` with `postToIframe` as a fallback — but the fallback also fails due to Research Task 1.

### Decision
Replace URL-based iframe lookup with session-ID-based lookup. Once `data-session-id` is on the container, `waitForExtraction` can find the iframe directly via `[data-session-id="${sessionId}"] iframe`.

### Rationale
- Session ID is unique and stable — doesn't change with redirects
- One lookup instead of retries
- Works correctly with multiple concurrent sessions

### Alternatives Considered
1. **Normalize URLs before matching**: Fragile — too many edge cases (trailing slashes, query param ordering, encoding)
2. **Use MutationObserver to track iframe src changes**: Over-engineered for this problem
3. **Add a unique ID to each iframe element**: Similar to session ID approach but requires extra state management

---

## Research Task 3: Missing Nonce Relay in Canvas Node Rendering

### Problem
When `EmbeddedWebView` is rendered from `CanvasNode.tsx:199-204`, no `channelNonce` prop is passed. The `waitForExtraction` method in toolRegistry.ts sends the nonce directly via `iframe.contentWindow.postMessage()`, bypassing the React component. This works because `webview_bridge.js` sets the nonce on first `EXTRACT_CONTENT` message.

### Root Cause Analysis
The current flow actually works for the initial extraction because:
1. `waitForExtraction` finds the iframe (or tries to) and sends `EXTRACT_CONTENT` with the nonce
2. `webview_bridge.js` sets `_channelNonce = msg.nonce` on first `EXTRACT_CONTENT` (webview_bridge.js:24-26)
3. Subsequent messages validate the nonce

However, the `EmbeddedWebView` component's own `sendMessageToIframe` method (line 40-48) also posts messages. If the component sends a message before `waitForExtraction`'s initial `EXTRACT_CONTENT`, the nonce won't be set yet. Currently this isn't an issue because the component doesn't proactively send messages.

### Decision
No changes needed for nonce relay. The current flow works because:
1. `waitForExtraction` always sends `EXTRACT_CONTENT` first (which sets the nonce)
2. The `EmbeddedWebView` component doesn't send messages proactively
3. The `sendMessageToIframe` handle is only used for ref-based calls which come after extraction

However, we should pass `channelNonce` to `EmbeddedWebView` as a defensive measure for future use. This is a minor improvement, not a fix.

### Rationale
The nonce mechanism works correctly; the real bugs are in iframe targeting (Tasks 1 & 2).

### Alternatives Considered
1. **Refactor to always pass nonce via React props**: Clean but unnecessary for the fix
2. **Keep as-is**: Current approach works; risk is low

---

## Research Task 4: Standalone browse_webview Without Canvas Node

### Problem
The `browse_webview` handler (toolRegistry.ts:402-526) creates a session but does NOT create a canvas node. It calls `waitForExtraction` which tries to find an iframe — but no iframe exists unless the caller (e.g., scrape node handler) created one.

### Root Cause Analysis
`browse_webview` is designed to be called after a canvas node already exists (via scrape handler or open_web_view). The `browse_webview` handler assumes the iframe is already rendered.

For the `scrape` flow:
1. Scrape handler creates canvas node (toolRegistry.ts:869-882)
2. Waits 100ms for React render (toolRegistry.ts:885)
3. Calls `browse_webview` (toolRegistry.ts:887-894)

For standalone `browse_webview` (e.g., LLM calls it directly):
- No canvas node is created
- `waitForExtraction` can't find an iframe
- Extraction times out

### Decision
This is a separate issue from iframe targeting. The targeting fix (session-ID-based lookup) will make the scrape flow work correctly. Standalone `browse_webview` without a canvas node is a design limitation that should be addressed in a future feature (auto-spawn canvas node from browse_webview).

### Rationale
The targeting fix solves the primary bug. Adding canvas node auto-spawning to `browse_webview` would be scope creep.

### Alternatives Considered
1. **Auto-spawn canvas node in browse_webview**: Would fix standalone calls but changes behavior significantly
2. **Return error if no iframe found immediately**: Better DX but changes error handling flow

---

## Summary of Decisions

| Issue | Decision | Impact |
|-------|----------|--------|
| Session/Node ID mismatch | Add `data-session-id` to iframe container | Fixes `postToIframe`, `sendInteractionToIframe`, `sendExtractBySelector` |
| Fragile URL lookup | Replace with session-ID-based `[data-session-id]` query | Fixes `waitForExtraction` primary lookup |
| Missing nonce relay | Pass `channelNonce` as optional prop (defensive) | Minor improvement for future use |
| Standalone browse_webview | Out of scope for this fix | Document as known limitation |

### Affected Files
1. `src/shared/types.ts` — Add `canvasNodeId` to `WebviewSession`
2. `src/popup/Canvas/EmbeddedWebView.tsx` — Add `sessionId` prop, render `data-session-id`
3. `src/popup/Canvas/CanvasNode.tsx` — Pass `sessionId` from canvas node content to `EmbeddedWebView`
4. `src/popup/services/toolRegistry.ts` — Fix `postToIframe`, `waitForExtraction`; wire `canvasNodeId` on session creation

### No Changes Needed
- `src/content/webview_bridge.js` — Works correctly with current nonce mechanism
- `manifest.json` — No new permissions needed
- `src/background/index.ts` — Not involved in iframe communication
