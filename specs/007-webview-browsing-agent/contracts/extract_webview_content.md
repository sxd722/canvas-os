# Tool Contract: extract_webview_content

**Version**: 1.0
**Status**: Proposed

## Purpose

Extract specific content from a loaded webview page using a CSS selector. Used for targeted data extraction (e.g., price values, specific text content) after the LLM has navigated to the right page.

## Input Schema

```json
{
  "name": "extract_webview_content",
  "description": "Extract specific content from a webview page using a CSS selector. Use after navigating to a target page to pull out specific data like prices, names, or structured content.",
  "parameters": {
    "type": "object",
    "properties": {
      "session_id": {
        "type": "string",
        "description": "The webview session ID"
      },
      "selector": {
        "type": "string",
        "description": "CSS selector targeting the content to extract"
      },
      "target": {
        "type": "string",
        "description": "Description of what data is being extracted (for result labeling)"
      }
    },
    "required": ["session_id", "selector", "target"]
  }
}
```

## Output Schema

```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": { "type": "string", "description": "Extracted text content" },
    "selector": { "type": "string" },
    "target": { "type": "string" },
    "match_count": { "type": "number", "description": "Number of elements matched by selector" },
    "error": { "type": "string" }
  }
}
```

## Behavior

1. Validate session exists and is in `loaded` or `interacting` status
2. Send `EXTRACT_BY_SELECTOR` postMessage to the iframe with the CSS selector
3. Content script runs `document.querySelectorAll(selector)`
4. For each match, extract `innerText` (or `value` for inputs)
5. Return concatenated text content with match count

## Error Cases

| Condition | Success | Error Message |
|-----------|---------|---------------|
| Session not found | false | "Session not found" |
| Session not loaded | false | "Session is not loaded (status: {status})" |
| Selector matches nothing | true | Returns empty `data` with `match_count: 0` |
| Invalid selector | false | "Invalid CSS selector: {selector}" |

## Usage Pattern

```javascript
// LLM navigates to MacBook Pro page, then:
extract_webview_content({
  session_id: "webview-123",
  selector: ".price-display, .product-price, [data-price]",
  target: "MacBook Pro prices in CAD"
})
// Returns: { success: true, data: "$1,499 $1,799 $2,099", match_count: 3, ... }
```
