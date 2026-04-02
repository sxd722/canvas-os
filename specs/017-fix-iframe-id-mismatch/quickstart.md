# Quickstart: Fix Iframe Targeting ID Mismatch

## Build & Test

```bash
npm run build    # Build the extension
npm run lint     # Run ESLint
npm test         # Run Vitest tests
```

## Verify the Fix

### Via CDP (Chrome DevTools Protocol)

1. Launch Chrome with remote debugging: `chrome --remote-debugging-port=9222`
2. Load the extension from `dist/` as unpacked
3. Open the popup and send a chat message like: "Open https://example.com"
4. Verify via console that extraction succeeds (look for `[ToolRegistry] waitForExtraction | found iframe by nodeId`)
5. Test DAG scrape: use ToolTester to invoke a scrape node and verify extraction returns content

### Manual Verification Checklist

- [ ] Chat browse_webview: iframe receives extraction message and returns content
- [ ] DAG scrape node: extraction succeeds on first lookup attempt
- [ ] Multiple concurrent webview nodes: each targets its own iframe independently
- [ ] Backward compatibility: ToolTester calls without canvasNodeId still work

## Key Files to Modify

| File | Change |
|------|--------|
| `src/popup/services/toolRegistry.ts` | Add `canvasNodeId` param to `postToIframe`, `waitForExtraction`, `sendInteractionToIframe`, `sendExtractBySelector`; thread through callers |
| `src/popup/App.tsx` | Pass canvas node ID as `canvasNodeId` in browse_webview tool call arguments |

## No New Dependencies

This fix uses existing DOM APIs and requires no new packages.
