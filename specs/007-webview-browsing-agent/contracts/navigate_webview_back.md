# Tool Contract: navigate_webview_back

**Version**: 1.0
**Status**: Proposed

## Purpose

Navigate back to the previous page in a webview session's history. Re-extracts content from the previous page.

## Input Schema

```json
{
  "name": "navigate_webview_back",
  "description": "Navigate back to the previous page in a webview session. Useful when the LLM navigated to the wrong page.",
  "parameters": {
    "type": "object",
    "properties": {
      "session_id": {
        "type": "string",
        "description": "The webview session ID"
      }
    },
    "required": ["session_id"]
  }
}
```

## Output Schema

```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "url": { "type": "string", "description": "URL after navigating back" },
    "title": { "type": "string" },
    "extraction": {
      "type": "object",
      "description": "Re-extracted page content from the previous page"
    },
    "error": { "type": "string" }
  }
}
```

## Behavior

1. Validate session exists and has navigation history (length > 1)
2. Send `NAVIGATE_BACK` postMessage to the iframe
3. Content script calls `window.history.back()`
4. Wait for page load (up to 10 seconds)
5. Pop last entry from navigation history
6. Re-extract page content with the original intent
7. Return extraction results

## Error Cases

| Condition | Success | Error Message |
|-----------|---------|---------------|
| Session not found | false | "Session not found" |
| No history to go back to | false | "Already at the initial page, cannot go back" |
| Back navigation failed | false | "Navigation back failed: {reason}" |
