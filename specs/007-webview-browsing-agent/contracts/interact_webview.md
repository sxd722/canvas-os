# Tool Contract: interact_webview

**Version**: 1.0
**Status**: Proposed

## Purpose

Interact with an element (click, fill, select) in an existing webview session. After interaction, wait for any navigation to complete and re-extract page content.

## Input Schema

```json
{
  "name": "interact_webview",
  "description": "Interact with an element in an existing webview. After interaction, extracts updated page content and returns new interactive elements.",
  "parameters": {
    "type": "object",
    "properties": {
      "session_id": {
        "type": "string",
        "description": "The webview session ID (from browse_webview result)"
      },
      "element_selector": {
        "type": "string",
        "description": "CSS selector of the element to interact with (from extraction elements list)"
      },
      "action": {
        "type": "string",
        "enum": ["click", "fill", "select"],
        "description": "The action to perform on the element"
      },
      "value": {
        "type": "string",
        "description": "Value to set (required for 'fill' and 'select' actions)"
      }
    },
    "required": ["session_id", "element_selector", "action"]
  }
}
```

## Output Schema

```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean",
      "description": "Whether the interaction succeeded"
    },
    "new_url": {
      "type": "string",
      "description": "URL after interaction (may differ if navigation occurred)"
    },
    "navigated": {
      "type": "boolean",
      "description": "Whether the interaction caused a page navigation"
    },
    "extraction": {
      "type": "object",
      "description": "Re-extracted page content (same schema as browse_webview extraction)"
    },
    "error": {
      "type": "string"
    }
  }
}
```

## Behavior

1. Validate `session_id` exists and is in `loaded` or `interacting` status
2. Send `INTERACT_ELEMENT` postMessage to the webview iframe
3. Content script finds the element via `document.querySelector(selector)`
4. Performs the action (click/fill/select)
5. Wait for potential navigation (up to 5 seconds):
   - If navigation detected: wait for `load` event, then re-extract
   - If no navigation: re-extract current page immediately
6. Return updated extraction with new interactive elements

## Error Cases

| Condition | Success | Error Message |
|-----------|---------|---------------|
| Invalid session_id | false | "Session not found: {session_id}" |
| Session closed | false | "Session is closed" |
| Max interactions reached | false | "Maximum interactions ({max}) reached for this session" |
| Element not found | false | "Element not found: {selector}" |
| Interaction failed | false | "Interaction failed: {reason}" |

## Interaction Limits

- Default max interactions per session: 10
- Incremented on each successful interaction
- Reset if the LLM explicitly requests a fresh extraction

## Dependencies

- Active `WebviewSession` in state
- Content script running in the target iframe
- `semanticExtractor.ts` for re-extraction scoring
