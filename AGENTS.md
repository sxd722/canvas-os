# canvas-coworker Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-31

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

## Recent Changes
- 009-fix-dag-config-scrape: Added TypeScript 5.x (ES2022) + React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3
- 008-dag-scrape-llm-calc: Added TypeScript 5.x (ES2022) + React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3
- 007-webview-browsing-agent: Added TypeScript 5.x (ES2022) + React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
