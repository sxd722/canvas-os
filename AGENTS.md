# canvas-coworker Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-02

## Active Technologies
- TypeScript 5.x / JavaScript ES2022 + React 18+
- Vite 5.x
- Tailwind CSS 3.x
- Chrome Extensions MV3 APIs
- chrome.storage.local (persistent), chrome.storage.session (ephemeral chat)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (003-fix-dag-architecture)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (003-fix-dag-architecture)
- TypeScript 5.x (ES2022) + React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3 (006-macbook-price-arbitrage)
- chrome.storage.local (LLM config), chrome.storage.session (ephemeral DAG state) (006-macbook-price-arbitrage)
- In-memory (React state) for webview sessions; chrome.storage for extension config (007-webview-browsing-agent)
- TypeScript 5.x (ES2022) + React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3 APIs (011-fix-dag-scrape-visibility)
- JavaScript ES2022 (webview_bridge.js), TypeScript 5.x (semanticExtractor.ts) + Chrome Extensions MV3, Transformers.js (existing) (012-improve-price-extraction)
- N/A (in-memory processing only) (012-improve-price-extraction)
- TypeScript 5.x (ES2022) + JavaScript ES2022 (014-bundle-model-inference)
- TypeScript 5.x (ES2022) + JavaScript ES2022 + React 18+, Vite 5.x, Chrome Extensions MV3, Tailwind CSS 3.x (015-fix-iframe-targeting)
- In-memory (React state for sessions); chrome.storage for extension config (015-fix-iframe-targeting)
- TypeScript 5.x (ES2022) + JavaScript ES2022 + React 18+ + Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3 (017-fix-iframe-id-mismatch)

## Project Structure

```text
src/
├── popup/               # Main extension popup UI
│   ├── App.tsx          # Root component
│   ├── Canvas/          # Canvas node rendering
│   ├── Chat/            # Chat interface components
│   ├── components/      # Shared UI components
│   ├── context/         # React contexts (HoverStateContext)
│   ├── hooks/           # Custom hooks (useDagEngine, useArtifacts, useMentions)
│   ├── services/        # Business logic services
│   └── workers/         # Web Workers for DAG execution
├── background/          # Service worker
├── content/             # Content scripts
├── shared/              # Shared types and utilities
└── tests/               # Test files
```

## Commands

- `npm run build` - Build the extension
- `npm run lint` - Run ESLint
- `npm test` - Run tests (vitest)
- `node test-tool-tester.cjs` - Test tools via CDP

## Code Style

TypeScript 5.x / JavaScript ES2022: Follow standard conventions

## Features Implemented

### Phase 5: @-Mentions (US3)
- Type `@` in chat to mention artifacts on canvas
- Hover over mentions highlights corresponding canvas node
- Mention format: `@[title](id)`
- Keyboard navigation in dropdown (Arrow keys, Enter, Escape)
- Deleted artifacts shown with strikethrough style

### Phase 6: Embedded Web Workspaces (US4)
- `open_web_view` tool opens URLs as embedded iframes
- Automatic URL pattern detection: "Open https://..."
- Loading, error, and blocked states handled gracefully
- "Open in new tab" fallback for blocked iframes

### Phase 7: Polish
- Error boundaries in DAG execution (failed nodes skip dependents)
- ToolTester service for testing tools without LLM API calls
- Max concurrent DAG nodes limited to 4

### Phase 8: Universal Semantic Lookup Tool (013-semantic-lookup-tool)
- **Semantic Chunks**: Extracts text content (p, span, td) paired with structural context (h1-h6 headings, th headers, aria-labels)
- **Context Pairing**: Walks up DOM tree to find closest meaningful context for each text element
- **Hybrid Payload**: Returns both `information_chunks` (top 5 static text) and `interactive_elements` (top 5 navigation elements)
- **Pure Cosine Similarity**: Uses Transformers.js embeddings for semantic ranking, no domain-specific boost logic
- **Hidden Element Filter**: Width/height > 0 check remains
- **Deduplication**: Set-based text tracking prevents duplicate chunks
- **No Hardcoded Patterns**: Removed all CURRENCY_PATTERN and price-specific logic from webview_bridge.js

### Phase 9: Bundle Model for Local Inference (014-bundle-model-inference)
- **Model Bundling**: Xenova/all-MiniLM-L6-v2 ONNX model (~22MB) bundled in public/models/
- **Offline Capability**: Model loads from local files with `local_files_only: true` option
- **Build Validation**: Build fails with clear error if model files are missing
- **No Network Requests**: Zero external requests to Hugging Face Hub during inference
- **Performance**: Model loads once per session, reused across all webview calls (singleton pattern)
- **Fallback**: TF-IDF scoring remains as fallback if model loading fails

## Testing via Chrome DevTools (CDP)

## Testing via Chrome DevTools (CDP)

The extension exposes testing utilities via `window` for CDP access on port 9222:

```javascript
// Access ToolTester
window.toolTester.invokeTool('open_web_view', { url: 'https://example.com', title: 'Test' })
window.toolTester.getAvailableTools()
window.toolTester.runTestSuite({ name: 'My Tests', tests: [...] })

// Access canvas nodes
window.__canvasNodes // Current canvas state
```

## Key Files

| Feature | Files |
|---------|-------|
| @-Mentions | `src/popup/hooks/useMentions.ts`, `src/popup/Chat/MentionDropdown.tsx`, `src/popup/Chat/ChatInput.tsx` |
| Hover Highlighting | `src/popup/context/HoverStateContext.tsx` |
| Web Views | `src/popup/Canvas/EmbeddedWebView.tsx`, `src/popup/services/toolRegistry.ts` |
| DAG Engine | `src/popup/hooks/useDagEngine.ts`, `src/popup/Canvas/DAGNode.tsx` |
| Tool Testing | `src/popup/services/toolTester.ts`, `src/popup/components/ToolTester/ToolTesterPanel.tsx` |
| Artifacts | `src/popup/hooks/useArtifacts.ts` |
| Semantic Lookup | `src/content/webview_bridge.js`, `src/popup/services/semanticExtractor.ts` |
| Model Bundling | `public/models/Xenova/all-MiniLM-L6-v2/`, `src/popup/services/semanticExtractor.ts`, `vite.config.js` |

## Recent Changes
- 017-fix-iframe-id-mismatch: Added TypeScript 5.x (ES2022) + JavaScript ES2022 + React 18+ + Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3
- 015-fix-iframe-targeting: Added TypeScript 5.x (ES2022) + JavaScript ES2022 + React 18+, Vite 5.x, Chrome Extensions MV3, Tailwind CSS 3.x
- 014-bundle-model-inference: Bundled Xenova/all-MiniLM-L6-v2 model locally, added build validation, enabled offline inference

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
