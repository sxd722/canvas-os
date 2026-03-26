# Quickstart: CanvasOS Agentic IDE Upgrade

**Feature Branch**: `002-agentic-ide-features`
**Date**: 2026-03-24

## Prerequisites

- Node.js 18+
- Chrome browser with Remote Debugging enabled
- GLM API key (or OpenAI/Anthropic)

## Setup

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# For development with watch mode
npm run dev
```

## Load Extension

1. Open Chrome with remote debugging: `chrome.exe --remote-debugging-port=9222`
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder

## Feature Testing

### 1. Context Optimization

```javascript
// In chat, load a file first via "Load File" button
// Then ask about it:
"What's in my uploaded file?"

// LLM will:
// 1. See only metadata in context: {id, title, type, summary}
// 2. Call read_artifact_content tool if needed
// 3. Receive full content via tool response
```

### 2. DAG Task Orchestration

```javascript
// Give a complex multi-step task:
"Research React hooks from the official docs, 
 write example code for useState and useEffect, 
 and create a summary of best practices"

// System will:
// 1. LLM generates DAG plan: [node1, node2, node3]
// 2. UI shows DAG visualization with status cards
// 3. Nodes execute concurrently where possible
// 4. Results appear as canvas artifacts
```

### 3. @-Mentions

```javascript
// Type @ in chat to see artifact dropdown
"Can you explain @myfile.txt in more detail?"

// Hover over @myfile.txt to highlight canvas node
// Mentioned artifacts get full content in LLM context
```

### 4. Embedded Web Workspaces

```javascript
// Request to open a URL:
"Open https://react.dev in a web view"

// Or LLM can open URLs via tool call
// View appears as interactive iframe in canvas
```

## Development Commands

```bash
# Run linting
npm run lint

# Run tests
npm test

# Build for production
npm run build

# Type checking
npx tsc --noEmit
```

## Debug via CDP

```bash
# List pages
curl http://localhost:9222/json

# Take snapshot of extension popup
# (use chrome-devtools MCP tools)
```

## File Structure Quick Reference

```
src/
├── popup/
│   ├── hooks/
│   │   ├── useArtifacts.ts      # Metadata/content separation
│   │   ├── useDagEngine.ts      # DAG orchestration
│   │   └── useMentions.ts       # @mention management
│   ├── context/
│   │   └── HoverStateContext.tsx # Global hover state
│   ├── services/
│   │   ├── dagExecutor.ts       # DAG execution logic
│   │   └── toolRegistry.ts      # Tool call handlers
│   └── Canvas/
│       ├── DAGNodeCard.tsx      # DAG node visualization
│       └── EmbeddedWebView.tsx  # Web view component
├── shared/
│   └── dagSchema.ts             # DAG JSON schema
└── background/
    └── index.ts                 # declarativeNetRequest setup
```

## Key Interfaces

```typescript
// Tool call format (OpenAI-compatible)
interface ToolCall {
  name: 'read_artifact_content' | 'open_web_view' | 'execute_dag';
  arguments: Record<string, unknown>;
}

// DAG node format
interface DAGNodeJSON {
  id: string;
  type: 'llm-call' | 'js-execution' | 'web-operation';
  params: object;
  dependencies: string[];
}

// Hover state
interface HoverState {
  hoveredNodeId: string | null;
  setHovered: (id: string | null) => void;
}
```
