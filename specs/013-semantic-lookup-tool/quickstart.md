# Quickstart: Universal Semantic Lookup Tool

**Feature**: 013-semantic-lookup-tool
**Date**: 2026-04-01

## Prerequisites
- Node.js 18+
- Chrome with Remote Debugging enabled (`--remote-debugging-port=9222`)
- Extension loaded from `dist/` as unpacked

## Build & Test
```bash
npm install
npm run build
npm run lint
npm test
```

## Testing the Feature
### Manual Testing
1. **Load a structured page**:
   - Open Chrome with debugging: `chrome --remote-debugging-port=9222`
   - Navigate to a page with structured content
   - Open the extension popup
   - Trigger extraction

   - Verify the payload contains both `information_chunks` and `interactive_elements` arrays

2. **Test semantic ranking**:
   - Provide various intents
   - Verify returned chunks are semantically relevant

3. **Test hybrid payload**:
   - Load a page with both information and links
   - Verify payload contains both arrays
   - Verify each array has top 5 items

### Automated Testing via CDP
```javascript
// Connect to Chrome DevTools Protocol
const ws = new WebSocket('ws://localhost:9222/devtools/page/...');

// Trigger extraction with intent
ws.send(JSON.stringify({
  type: 'EXTRACT_CONTENT',
  nonce: 'test-nonce-123',
  intent: 'Find contact information'
}));

// Verify response structure
ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  if (response.type === 'CONTENT_RESPONSE') {
    console.log('information_chunks:', response.extraction.information_chunks.length);
    console.log('interactive_elements:', response.extraction.interactive_elements.length);
    // Verify both arrays exist and have top 5 items each
  }
};
```

## Test Cases
| Test | Intent | Expected Result |
|------|-------|---------------|
| Information extraction | "Find contact information" | Both `information_chunks` and `interactive_elements` arrays exist |
| Semantic ranking | "Find the CEO's email" | CEO-related chunks rank higher |
| Hybrid payload | Intent with action | `interactive_elements` includes relevant options |
| Empty arrays | Page with no text | Empty arrays returned (no crash) |

## Verification Checklist
- [ ] Information chunks include structural context
- [ ] Semantic ranking uses cosine similarity (no hardcoded patterns)
- [ ] Hybrid payload has two arrays
- [ ] Both arrays have top 5 items
- [ ] Hidden elements filtered out
- [ ] Build passes with no errors
- [ ] Lint passes (pre-existing errors acceptable)

