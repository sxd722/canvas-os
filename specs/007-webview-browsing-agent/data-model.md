# Data Model: Interactive Webview Browsing Agent

**Feature**: 007-webview-browsing-agent
**Date**: 2026-03-30

## Entities

### WebviewSession

Represents an active webview browsing session tied to a canvas node.

```typescript
interface WebviewSession {
  /** Unique session ID, matches canvas node ID (e.g., "webview-1234567890") */
  id: string;

  /** Current URL loaded in the webview */
  currentUrl: string;

  /** Initial URL requested by the LLM */
  originalUrl: string;

  /** Title of the current page */
  title: string;

  /** Current loading status */
  status: WebviewStatus;

  /** Navigation history stack (for back navigation) */
  navigationHistory: NavigationEntry[];

  /** The LLM's stated intent for this browsing session */
  intent: string;

  /** Number of interactions performed in this session */
  interactionCount: number;

  /** Maximum allowed interactions before forced stop */
  maxInteractions: number;

  /** Channel nonce for postMessage validation */
  channelNonce: string;

  /** Timestamp when session was created */
  createdAt: number;

  /** Timestamp of last activity */
  lastActiveAt: number;
}

type WebviewStatus = 'loading' | 'loaded' | 'interacting' | 'blocked' | 'error' | 'closed';
```

**Storage**: In-memory only (React state in App.tsx). Sessions are ephemeral — they exist only while the popup is open.

**Relationships**:
- One-to-one with a `CanvasNode` of type `'web-view'`
- Has many `NavigationEntry` items
- Has many `PageExtraction` results over time

---

### NavigationEntry

A single entry in a webview session's navigation history.

```typescript
interface NavigationEntry {
  /** URL of the page */
  url: string;

  /** Page title (if available) */
  title: string;

  /** Timestamp when navigation occurred */
  timestamp: number;

  /** How the user arrived: 'initial' | 'link_click' | 'back' | 'forward' */
  navigationType: string;
}
```

---

### InteractiveElement

A clickable/interactable element extracted from a webview page.

```typescript
interface InteractiveElement {
  /** Unique element ID within the page extraction */
  id: string;

  /** CSS selector for targeting the element */
  selector: string;

  /** XPath fallback if CSS selector fails */
  xpath: string;

  /** Element type */
  type: ElementType;

  /** Visible text content of the element */
  text: string;

  /** Brief description for LLM consumption */
  description: string;

  /** URL for links (if applicable) */
  href?: string;

  /** Input type for form elements (if applicable) */
  inputType?: string;

  /** Input placeholder text (if applicable) */
  placeholder?: string;

  /** Relevance score to the browsing intent (0-1) */
  relevanceScore: number;

  /** Bounding rect for visual debugging */
  boundingRect?: { x: number; y: number; width: number; height: number };
}

type ElementType = 'link' | 'button' | 'input' | 'select' | 'textarea' | 'clickable-div' | 'other';
```

**Notes**:
- `selector` is the primary mechanism for interaction — the content script uses `document.querySelector(selector)` to find and interact with elements
- `xpath` is a fallback when CSS selectors are insufficient
- `relevanceScore` is computed by the extraction engine (TF-IDF or embedding-based)

---

### PageExtraction

The result of extracting content from a webview page at a point in time.

```typescript
interface PageExtraction {
  /** URL of the page that was extracted */
  url: string;

  /** Page title */
  title: string;

  /** Page summary: extracted headings, meta description, first paragraph */
  summary: string;

  /** List of interactive elements found and scored */
  elements: InteractiveElement[];

  /** Method used for extraction */
  extractionMethod: 'tfidf' | 'embedding' | 'heuristic' | 'css-selector';

  /** Timestamp of extraction */
  extractedAt: number;

  /** Total number of elements before filtering (for debug) */
  totalElementsFound: number;

  /** Whether extraction succeeded fully */
  success: boolean;

  /** Error message if extraction failed */
  error?: string;
}
```

**Lifecycle**:
1. Webview loads page → content script detects `load` event
2. Content script extracts all interactive elements from DOM
3. Scoring engine ranks elements against `intent`
4. Top-N elements (default 15) are returned in `PageExtraction`
5. Result is sent to popup via postMessage, then forwarded to LLM

---

### BrowsingIntent

The LLM's stated goal for a browsing session.

```typescript
interface BrowsingIntent {
  /** Original user message that triggered the browsing */
  userMessage: string;

  /** Extracted intent keywords/phrases */
  keywords: string[];

  /** Full intent description (LLM-generated) */
  description: string;

  /** The webview session this intent is associated with */
  sessionId: string;
}
```

**Notes**:
- Created when the LLM calls `open_web_view` with a purpose/intent parameter
- Updated when the LLM refines its search direction
- Used by the extraction engine to score element relevance

---

### BrowseDAGNode (extends DAGNode)

Specialized DAG node parameters for webview browsing operations.

```typescript
interface BrowseDAGNodeParams {
  /** For webview-browse: URL to open */
  url?: string;

  /** For webview-browse: Title/label for the webview */
  title?: string;

  /** For webview-interact: Session ID of the target webview */
  sessionId?: string;

  /** For webview-interact: Selector of the element to interact with */
  elementSelector?: string;

  /** For webview-interact: Action to perform */
  action?: 'click' | 'fill' | 'select';

  /** For webview-interact: Value for fill/select actions */
  value?: string;

  /** For webview-extract: CSS selector for targeted extraction */
  extractSelector?: string;

  /** For webview-extract: What data to extract */
  extractTarget?: string;
}
```

**Integration with existing DAG schema**:
- Add `'webview-browse' | 'webview-interact' | 'webview-extract'` to `DAGNodeType` in `dagSchema.ts`
- These node types use `BrowseDAGNodeParams` as their `params` field
- Execution handled in `executeNodeWithWorker` in `toolRegistry.ts`

---

## Message Protocol (postMessage)

### Popup → Iframe (commands)

```typescript
type PopupToIframeMessage =
  | { type: 'EXTRACT_CONTENT'; nonce: string; intent: string }
  | { type: 'INTERACT_ELEMENT'; nonce: string; selector: string; action: 'click' | 'fill' | 'select'; value?: string }
  | { type: 'NAVIGATE_BACK'; nonce: string }
  | { type: 'GET_PAGE_STATUS'; nonce: string }
  | { type: 'EXTRACT_BY_SELECTOR'; nonce: string; selector: string };
```

### Iframe → Popup (responses)

```typescript
type IframeToPopupMessage =
  | { type: 'CONTENT_RESPONSE'; nonce: string; extraction: PageExtraction }
  | { type: 'INTERACTION_RESULT'; nonce: string; success: boolean; newUrl?: string; error?: string }
  | { type: 'NAVIGATION_COMPLETE'; nonce: string; url: string; title: string }
  | { type: 'PAGE_STATUS'; nonce: string; status: WebviewStatus; url: string }
  | { type: 'EXTRACT_RESULT'; nonce: string; data: string; success: boolean; error?: string };
```

---

## Tool Definitions (LLM-facing)

### `browse_webview`

```typescript
{
  name: 'browse_webview',
  description: 'Open a URL in an embedded webview and extract relevant interactive elements based on a browsing intent',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to open in the webview' },
      title: { type: 'string', description: 'Label for the webview node' },
      intent: { type: 'string', description: 'What you are looking for on this page' }
    },
    required: ['url', 'intent']
  }
}
```

**Returns**: `{ sessionId, status, url, extraction: PageExtraction }`

### `interact_webview`

```typescript
{
  name: 'interact_webview',
  description: 'Interact with an element in an existing webview (click, fill input, select option)',
  parameters: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Webview session ID' },
      element_selector: { type: 'string', description: 'CSS selector of the element' },
      action: { type: 'string', enum: ['click', 'fill', 'select'] },
      value: { type: 'string', description: 'Value for fill/select actions' }
    },
    required: ['session_id', 'element_selector', 'action']
  }
}
```

**Returns**: `{ success, newUrl, extraction: PageExtraction }` (re-extracts after interaction)

### `navigate_webview_back`

```typescript
{
  name: 'navigate_webview_back',
  description: 'Navigate back to the previous page in a webview session',
  parameters: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Webview session ID' }
    },
    required: ['session_id']
  }
}
```

**Returns**: `{ success, url, extraction: PageExtraction }`

### `extract_webview_content`

```typescript
{
  name: 'extract_webview_content',
  description: 'Extract specific content from a webview page using a CSS selector',
  parameters: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Webview session ID' },
      selector: { type: 'string', description: 'CSS selector for targeted extraction' },
      target: { type: 'string', description: 'Description of what data to extract' }
    },
    required: ['session_id', 'selector', 'target']
  }
}
```

**Returns**: `{ success, data: string, selector, target }`

---

## Storage Strategy

| Data | Storage | Lifetime |
|------|---------|----------|
| WebviewSession | React state (in-memory) | While popup is open |
| NavigationHistory | Within WebviewSession | While popup is open |
| PageExtraction | Within conversation history (as tool results) | While chat is active |
| BrowsingIntent | Within tool call parameters | Ephemeral |
| BrowseDAGNode | DAGPlan (via useDagEngine) | While DAG is active |

**No chrome.storage needed** — all browsing state is ephemeral and tied to the popup session. If the popup closes, browsing sessions are lost (by design — web browsing is interactive/real-time).

---

## Type File Locations

New types should be added to:
- `src/shared/types.ts` — `WebviewSession`, `InteractiveElement`, `PageExtraction`, `BrowsingIntent`, message types
- `src/shared/dagSchema.ts` — New `DAGNodeType` values and `BrowseDAGNodeParams`
- `src/popup/services/toolRegistry.ts` — New tool definitions and handlers
