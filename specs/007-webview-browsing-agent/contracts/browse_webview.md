# Tool Contract: browse_webview

**Version**: 1.0
**Status**: Proposed

## Purpose

Open a URL in an embedded webview iframe, wait for the page to load, inject content script, extract interactive elements, and return the results to the LLM.

## Input Schema

```json
{
  "name": "browse_webview",
  "description": "Open a URL in an embedded webview and extract relevant interactive elements based on a browsing intent. Creates a new webview canvas node.",
  "parameters": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The URL to open in the webview"
      },
      "title": {
        "type": "string",
        "description": "A descriptive label for the webview node on the canvas"
      },
      "intent": {
        "type": "string",
        "description": "What you are looking for on this page. Used to prioritize which interactive elements are returned."
      }
    },
    "required": ["url", "intent"]
  }
}
```

## Output Schema

```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "description": "Unique webview session ID. Use this for subsequent interactions."
    },
    "status": {
      "type": "string",
      "enum": ["loaded", "blocked", "error"],
      "description": "Load status of the webview"
    },
    "url": {
      "type": "string",
      "description": "Actual URL loaded (may differ from requested URL due to redirects)"
    },
    "title": {
      "type": "string",
      "description": "Page title"
    },
    "extraction": {
      "type": "object",
      "description": "Extracted page content and interactive elements",
      "properties": {
        "summary": { "type": "string" },
        "elements": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "selector": { "type": "string" },
              "type": { "type": "string" },
              "text": { "type": "string" },
              "description": { "type": "string" },
              "href": { "type": "string" },
              "relevance_score": { "type": "number" }
            }
          }
        },
        "total_elements_found": { "type": "number" }
      }
    },
    "error": {
      "type": "string",
      "description": "Error message if status is 'blocked' or 'error'"
    }
  }
}
```

## Behavior

1. Create a new canvas node of type `'web-view'` with the provided URL
2. Render `EmbeddedWebView` component with the URL
3. Wait for page load (up to 10 seconds timeout)
4. If blocked (X-Frame-Options/CSP), return status `blocked` with fallback message
5. If loaded, inject content script (via `all_frames: true` manifest entry)
6. Content script extracts interactive elements from DOM
7. Score elements against the provided `intent` using TF-IDF
8. Return top 15 elements sorted by relevance score

## Error Cases

| Condition | Status | Error Message |
|-----------|--------|---------------|
| Invalid URL | `error` | "Invalid URL: {url}" |
| Load timeout (>10s) | `error` | "Page load timed out" |
| Iframe blocked | `blocked` | "Site blocks iframe embedding. Consider opening in a new tab." |
| Extraction failed | `loaded` | Extraction object with empty elements and error message |

## Dependencies

- `EmbeddedWebView.tsx` — iframe rendering
- `content/webview_bridge.js` — content script for DOM extraction
- `src/popup/services/semanticExtractor.ts` — TF-IDF scoring engine

## Canvas Side Effects

- Creates a new `CanvasNode` of type `'web-view'` on the canvas
- Sets node content to `{ url, title, status, sessionId }`
