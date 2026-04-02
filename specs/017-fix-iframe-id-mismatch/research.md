# Research: Fix Iframe Targeting ID Mismatch

## Bug Analysis

### Root Cause

Two independent ID systems exist for locating webview iframe containers:

1. **Canvas Node ID** — created by `generateId()` (App.tsx:172) or `dag-node-${node.id}` (toolRegistry.ts:873). Stored as `data-node-id` on the container div (EmbeddedWebView.tsx:161). Always available at render time.

2. **Session ID** — created by `webview-${Date.now()}` (useWebviewSessions.ts:19). Stored as `data-session-id` on the container div (EmbeddedWebView.tsx:161). Created AFTER the canvas node is rendered.

The iframe lookup functions (`postToIframe`, `waitForExtraction`, `sendInteractionToIframe`, `sendExtractBySelector`) exclusively use `data-session-id` to find iframe containers. At the time these functions are called, the session ID has not yet been written back to the canvas node's content, so `data-session-id` is `"undefined"` in the DOM.

### Affected Code Paths

| Path | Canvas Node Created | Session Created | Session Written Back | Lookup Result |
|------|-------------------|----------------|---------------------|---------------|
| Chat browse_webview | App.tsx:171 | toolRegistry.ts:421 | **Never** | FAIL |
| DAG scrape → browse_webview | toolRegistry.ts:873 | toolRegistry.ts:421 | toolRegistry.ts:906 (after return) | FAIL (race condition) |
| Direct browse_webview via ToolTester | No canvas node | toolRegistry.ts:421 | N/A | Depends on session writeback |

### All Functions That Need Fixing

| Function | File:Line | Current Lookup | Calls |
|----------|-----------|---------------|-------|
| `postToIframe` | toolRegistry.ts:1173 | `[data-session-id="${sessionId}"]` | Called by waitForExtraction, sendInteractionToIframe, sendExtractBySelector, scrape handler |
| `waitForExtraction` | toolRegistry.ts:1267 | `[data-session-id="${sessionId}"]` | Called by browse_webview handler |
| `sendInteractionToIframe` | toolRegistry.ts:1325 | Calls `postToIframe(sessionId, ...)` | Called by interact_webview handler |
| `sendExtractBySelector` | toolRegistry.ts:1395 | Calls `postToIframe(sessionId, ...)` | Called by extract_by_selector handler |

## Fix Design

### Decision: Use `data-node-id` as primary lookup with `data-session-id` fallback

**Rationale**: Canvas node IDs are always available at render time — they are set before React renders the iframe container. Session IDs are created later and may never be written back to the DOM. Using `data-node-id` as the primary lookup eliminates the race condition entirely.

**Alternatives considered**:

1. **Pre-generate session ID before creating canvas node** — Rejected because `createSession` is inside `useWebviewSessions` React hook, not accessible from App.tsx's canvas node creation. Would require extracting session creation into a synchronous utility and threading the session ID through the canvas node creation → React render → browse_webview call chain.

2. **Write session ID back before extraction, then await a render cycle** — Rejected because React state updates are asynchronous and unpredictable. Even with `await new Promise(r => setTimeout(r, 100))`, there's no guarantee the DOM has been updated. This is fragile and unreliable.

3. **Use MutationObserver to wait for `data-session-id` update** — Rejected as over-engineered. The session ID may never be written back (chat path), and the canvas node ID is already reliably set.

### Implementation Plan

1. **Modify `postToIframe`** (toolRegistry.ts:1173): Add optional `canvasNodeId` parameter. If provided, look up by `[data-node-id="${canvasNodeId}"]` first, fall back to `[data-session-id="${sessionId}"]`.

2. **Modify `waitForExtraction`** (toolRegistry.ts:1193): Add optional `canvasNodeId` parameter. Use `[data-node-id="${canvasNodeId}"]` in retry loop, pass to `postToIframe` on fallback.

3. **Modify `sendInteractionToIframe`** (toolRegistry.ts:1292): Add optional `canvasNodeId` parameter. Pass through to `postToIframe`.

4. **Modify `sendExtractBySelector`** (toolRegistry.ts:1368): Add optional `canvasNodeId` parameter. Pass through to `postToIframe`.

5. **Modify `browse_webview` handler** (toolRegistry.ts:410): When `canvasNodeId` is provided in arguments, pass it to `waitForExtraction`.

6. **Modify `interact_webview` handler** (toolRegistry.ts:534): Look up session's `canvasNodeId` from webviewSessions and pass to `sendInteractionToIframe`.

7. **Modify `extract_by_selector` handler**: Look up session's `canvasNodeId` and pass to `sendExtractBySelector`.

8. **Modify App.tsx chat path** (App.tsx:166): Pass the canvas node ID into the browse_webview tool call arguments as `canvasNodeId`.

### Backward Compatibility

- When `canvasNodeId` is not provided (e.g., direct ToolTester calls without canvas nodes), the system falls back to `data-session-id` lookup, which works when session ID has been written back to the DOM.
- The `data-node-id` attribute is already set on all iframe containers (EmbeddedWebView.tsx:161), so no DOM changes are needed.
- Session ID writeback in the scrape handler (toolRegistry.ts:906) can remain as-is for completeness.

### Edge Cases

- **Canvas node deleted before extraction**: `querySelector` returns null, existing warning logs fire, extraction fails with "container not found". No behavior change needed.
- **Multiple concurrent webview nodes**: Each has a unique `data-node-id`, so `querySelector` targets only the correct iframe. No cross-contamination.
- **No canvasNodeId provided**: Falls back to `data-session-id` lookup. Maintains backward compatibility.
