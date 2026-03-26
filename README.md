# CanvasOS Agentic IDE

A Chrome Extension that provides an agentic IDE experience with a split chat/canvas interface, DAG task orchestration, and embedded web workspaces.

## Features

### Core Interface
- **Chat Panel (30%)**: Interact with LLM APIs (OpenAI, Anthropic, GLM, or custom)
- **Canvas Panel (70%)**: Infinite canvas with pan/zoom for displaying nodes and artifacts
- **Context Optimization**: Only artifact metadata is sent to LLM by default, reducing context size by 80%+

### File & Content
- **File Loading**: Load local files (text or images) and display them on canvas
- **Image OCR**: Automatically extract text from uploaded images
- **Research Automation**: Type "Research [URL]" to scrape web content
- **Embedded Web Views**: Open URLs directly in canvas as interactive iframes

### Agentic Features
- **DAG Task Orchestration**: Complex tasks are visualized as Directed Acyclic Graphs with concurrent execution
- **@-Mentions**: Reference canvas artifacts in chat using `@[title](id)` syntax
- **Hover Highlighting**: Hovering over @mentions highlights the corresponding canvas node
- **Sandboxed Code Execution**: Execute LLM-generated JavaScript safely in isolated iframe

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Chrome browser (version 86+)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/sxd722/canvas-os.git
   cd canvas-os
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `dist` folder from this project

5. **Configure LLM Provider**
   - Click the CanvasOS extension icon in Chrome toolbar
   - Click the Settings (gear) button
   - Select your LLM provider
   - Enter your API key
   - Click Save

## Supported LLM Providers

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-4o-mini, GPT-4o, GPT-4-turbo, GPT-3.5-turbo |
| **Anthropic** | Claude 3 Opus, Sonnet, Haiku |
| **GLM (智谱AI)** | glm-5, glm-4-flash, glm-4, glm-4-plus, glm-3-turbo |
| **Custom** | Any OpenAI-compatible endpoint |

## Usage Guide

### Basic Chat
- Type messages in the chat input at the bottom
- AI responses appear in the chat panel
- Generated content appears as nodes on the canvas

### Loading Files
1. Click the **Load File** button
2. Select a file (text files: txt, md, json, js, ts, html, css; images: png, jpg, etc.)
3. Text files display content as a canvas node
4. Images display a preview with OCR-extracted text below

### @-Mentions
1. Type `@` in the chat input
2. A dropdown shows available canvas artifacts
3. Select an artifact to insert `@[title](id)`
4. Hover over mentions to highlight the corresponding canvas node
5. Mentioned artifacts' full content is sent to the LLM

### Research URLs
- Type `Research https://example.com` in chat
- The extension scrapes the page content
- A summary appears as a new canvas node

### Embedded Web Views
- Type `Open https://example.com` in chat
- The URL opens as an interactive iframe in the canvas
- If embedding is blocked, a link to open in new tab is provided

### DAG Task Orchestration
- Give complex multi-step tasks like "Research React hooks, write example code, and create a summary"
- The LLM generates a visual DAG plan
- Independent tasks execute concurrently
- Progress is displayed in real-time on canvas

## Development

```bash
npm run dev       # Watch mode with hot rebuilds
npm run build     # Production build
npm run lint      # Run ESLint
npm test          # Run tests with Vitest
```

## Project Structure

```
src/
├── popup/               # Main extension popup UI
│   ├── App.tsx          # Root component
│   ├── Canvas/          # Canvas node rendering
│   ├── Chat/            # Chat interface components
│   ├── components/      # Shared UI components
│   ├── context/         # React contexts
│   ├── hooks/           # Custom hooks (useDagEngine, useArtifacts, useMentions)
│   ├── services/        # Business logic services
│   └── workers/         # Web Workers for DAG execution
├── background/          # Service worker
├── content/             # Content scripts
└── shared/              # Shared types and utilities
```

## Technical Stack

- **React 18+** - UI framework
- **Vite 5.x** - Build tool
- **TypeScript 5.x** - Type safety
- **Tailwind CSS 3.x** - Styling
- **Chrome Extensions MV3** - Extension APIs
- **Vitest** - Testing

## GLM Configuration (智谱AI)

1. Get your API key from [bigmodel.cn](https://bigmodel.cn/usercenter/proj-mgmt/apikeys)
2. Select "GLM (智谱AI)" as provider
3. Enter your API key
4. Choose a model:
   - `glm-5`: Latest reasoning model
   - `glm-4-flash`: Fast and cost-effective
   - `glm-4`: Balanced performance
   - `glm-4-plus`: Enhanced capabilities
5. Click Save

## License

MIT
