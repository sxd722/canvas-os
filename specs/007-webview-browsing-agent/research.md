# Research: Interactive Webview Browsing Agent

**Feature**: 007-webview-browsing-agent
**Date**: 2026-03-30
**Status**: Complete

## Research Questions

### RQ1: How to extract content from cross-origin webview iframes in MV3?

**Decision**: Content script injection with `all_frames: true` + postMessage bridging.

**Approach**:
1. Add a content script (`content/webview_bridge.js`) to manifest with `"all_frames": true` and `"match_origin_as_fallback": true`
2. The content script runs inside every frame (including cross-origin iframes within our popup)
3. It reads its own DOM, extracts interactive elements (links, buttons, inputs), and sends results via `window.postMessage` to the parent frame
4. The popup listens for these messages and processes them

**Key Technical Details**:
- `chrome.scripting.executeScript` with `frameId` targeting is the alternative for specific frame injection
- For our use case (webviews inside popup), `all_frames` is simpler and more reliable
- Cross-origin iframes CAN have content scripts injected if `host_permissions` includes the origin
- Content script can read its own frame's DOM even when cross-origin (it runs in the frame's context)
- `postMessage` is the standard cross-origin communication channel

**Caveats**:
- Some sites use CSP headers that may block content script injection
- Sandbox attribute on iframe may restrict content script execution
- Large DOM payloads need to be chunked or summarized before posting

**Evidence**:
- Chrome MV3 content_scripts docs: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- chrome.scripting API: https://developer.chrome.com/docs/extensions/reference/api/scripting
- MDN Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage

---

### RQ2: Which embedding model to use for local semantic extraction?

**Decision**: Start with TF-IDF heuristic baseline, then upgrade to Transformers.js with a small model if needed.

**Rationale**: 
The primary goal is extracting relevant elements from web pages based on LLM intent — not building a search engine. A two-tier approach is pragmatic:

**Tier 1 (MVP) — TF-IDF + Heuristic Scoring**:
- Zero additional dependencies
- Extract all interactive elements (links, buttons, inputs, selects)
- Score each element using TF-IDF cosine similarity against the browsing intent
- Return top-N elements with highest relevance scores
- Fallback to heading/section-based extraction when TF-IDF yields low scores
- Implementation: ~200 lines of pure JS, no model weights, instant loading

**Tier 2 (Enhancement) — Transformers.js + MiniLM**:
- Use `@huggingface/transformers` (formerly `@xenova/transformers`) for in-browser inference
- Model: `all-MiniLM-L6-v2` (sentence-transformers) — ~25MB quantized
- Embed both the intent string and each element's text, rank by cosine similarity
- WASM-based inference, works in MV3 content scripts
- Significantly better semantic matching for complex intents

**Why TF-IDF first**:
- Constitution principle II requires all dependencies in package.json and bundled
- A 25MB model weight significantly increases extension size
- TF-IDF is sufficient for the initial use case (matching "MacBook Pro price" against page links)
- Can be upgraded transparently — the interface between extraction and the rest of the system stays the same

**Evidence**:
- Transformers.js: https://github.com/huggingface/transformers.js
- WebGPU Embedding Benchmark: https://huggingface.co/spaces/Xenova/webgpu-embedding-benchmark
- ONNX Runtime Web: https://www.npmjs.com/package/onnxruntime-web
- USE Lite: https://github.com/tensorflow/tfjs-models/blob/master/universal-sentence-encoder/README.md
- Tiny TF-IDF: https://github.com/kerryrodden/tiny-tfidf

---

### RQ3: How to handle webview navigation and back-tracking?

**Decision**: Content script tracks navigation history via `webNavigation` events, back navigation via `history.back()` triggered through postMessage.

**Approach**:
1. Content script in the iframe maintains a navigation stack (URLs visited)
2. Each navigation within the iframe is detected via `load` events
3. Back navigation is triggered by the popup sending a `NAVIGATE_BACK` message to the content script
4. The content script calls `window.history.back()` and waits for the page to reload
5. After reload, re-extraction occurs automatically

**Alternative considered**: `chrome.webNavigation.onCompleted` in background script — rejected because it requires tracking tab/frame IDs across the popup's embedded iframes, which is complex. Content script approach is self-contained.

---

### RQ4: How to structure the new DAG node types for webview browsing?

**Decision**: Add three new DAG node types to `dagSchema.ts`.

**New Types**:
1. `webview-browse` — Opens a URL in a webview iframe, waits for load, extracts initial content
2. `webview-interact` — Interacts with an element (click, fill) in an existing webview, waits for page update, extracts updated content
3. `webview-extract` — Extracts specific data from a loaded webview page (e.g., price values)

**Execution flow**:
- `webview-browse` creates the iframe, injects content script, extracts elements, returns `PageExtraction`
- `webview-interact` sends interaction command to existing webview, waits for navigation, re-extracts
- `webview-extract` performs targeted extraction (e.g., CSS selector-based) on a loaded page

**Why separate types**: Each has distinct inputs, outputs, and error modes. Separation allows the DAG engine to handle them differently (e.g., timeout policies, retry logic).

---

### RQ5: How to communicate between popup and webview content scripts?

**Decision**: Three-layer communication architecture.

```
LLM (in chat loop)
    ↓ tool call
App.tsx (tool handler)
    ↓ postMessage (via iframe ref)
EmbeddedWebView.tsx (iframe host)
    ↓ postMessage (window.parent / window)
webview_bridge.js (content script in iframe)
    ↓ DOM access
Web page DOM
```

**Message Protocol**:
- `EXTRACT_CONTENT` → popup → iframe: "Extract interactive elements"
- `CONTENT_RESPONSE` → iframe → popup: "Here are the extracted elements + page summary"
- `INTERACT_ELEMENT` → popup → iframe: "Click/fill element with selector X"
- `NAVIGATE_BACK` → popup → iframe: "Go back one page"
- `NAVIGATION_COMPLETE` → iframe → popup: "New page loaded, ready for extraction"
- `PAGE_STATUS` → iframe → popup: "Page load status (loading/loaded/error)"

**Security**:
- All messages validated with a nonce/channel ID to prevent spoofing
- Only process messages from expected iframe origins

---

### RQ6: What existing patterns should we follow?

**From explore agent research**:

1. **Tool registration pattern** (`toolRegistry.ts`):
   - Define tool in `toolDefinitions` array with name, description, parameters (JSON Schema)
   - Register handler via `registerHandler(name, async (args) => { ... })`
   - Called via `executeTool(toolCall)` from App.tsx

2. **DAG execution pattern** (`toolRegistry.ts`):
   - `executeDAGWithWorkers` handles topological sort, level-based concurrency (max 4)
   - `executeNodeWithWorker` dispatches by node type
   - Progress notification via `notifyDAGExecution(planId, nodes, status)`
   - Results stored in `nodeResults` Map keyed by planId

3. **Canvas node update pattern** (`App.tsx`):
   - `subscribe((plan) => { ... })` via `useDagEngine`
   - Maps plan nodes to canvas nodes: updates `content.status`, `content.result`, `content.error`
   - DAGNode component renders based on status/type

4. **Webview creation pattern** (`App.tsx`):
   - `handleToolCall` creates canvas node of type `'web-view'` when `open_web_view` is called
   - `EmbeddedWebView.tsx` renders the iframe with status lifecycle
   - Status: loading → loaded/blocked/error

---

## Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content extraction from iframes | Content script with `all_frames: true` | Simplest MV3 pattern, works cross-origin |
| Semantic matching | TF-IDF baseline, Transformers.js upgrade path | Minimizes extension size, sufficient for MVP |
| Navigation tracking | Content script-side `load` events + history stack | Self-contained, no background script complexity |
| New DAG node types | `webview-browse`, `webview-interact`, `webview-extract` | Clear separation of concerns |
| Popup↔iframe communication | postMessage with nonce validation | Standard cross-origin pattern, secure |
| Back navigation | `history.back()` via postMessage | Native browser API, reliable |

## Open Questions (Resolved During Implementation)

- ~~Model weights packaging~~ → TF-IDF first, no weights needed
- ~~Concurrent webview limit~~ → Reuse existing `maxConcurrent = 4` from DAG engine
- ~~Element selector strategy~~ → CSS selectors + XPath fallback for element targeting
