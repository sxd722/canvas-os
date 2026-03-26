# Quickstart: CanvasOS Agentic IDE

**Feature Branch**: `001-canvasos-agentic-ide`
**Date**: 2026-03-24

## Prerequisites

- Node.js 18+ installed
- Chrome browser 86+ (for MV3 and File System Access API support)
- LLM API key (OpenAI, Anthropic, or compatible service)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure LLM API

1. Open Chrome and navigate to `chrome://extensions`
2. Enable Developer mode (top right)
3. Load the extension unpacked from the `dist/` folder
4. Open the extension popup and configure your LLM API key in Settings

### 3. Development Build

```bash
npm run dev
```

This starts Vite in watch mode with HMR for fast development.

### 4. Load Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` folder from this project

### 5. Open CanvasOS

Click the CanvasOS extension icon in the Chrome toolbar.

## Testing

### Manual Testing Checklist

- [ ] Extension popup opens with 30/70 split layout
- [ ] Chat interface sends and receives messages
- [ ] Canvas pans smoothly with mouse drag
- [ ] "Load Local File" button opens file picker
- [ ] File content displays on canvas as a node
- [ ] "Research https://example.com" scrapes and summarizes content
- [ ] Code execution in sandbox returns results
- [ ] Error states display user-friendly messages

### CDP Integration Testing

1. Launch Chrome with remote debugging:
   ```bash
   chrome --remote-debugging-port=9222
   ```

2. Run integration tests:
   ```bash
   npm run test:integration
   ```

## Development Workflow

### Making Changes

1. Edit source files in `src/`
2. Vite automatically rebuilds (watch mode)
3. Reload extension in `chrome://extensions/`
4. Test changes

### Building for Production

```bash
npm run build
```

The `dist/` folder contains the production-ready extension.

### Creating a Release Package

```bash
npm run build
# Then manually zip the dist/ folder for Chrome Web Store submission
```

## Troubleshooting

### Extension Not Loading

- Check `manifest.json` in `dist/` folder
- Verify all file paths in manifest are correct
- Check Chrome DevTools console for errors

### Sandbox Not Working

- Verify `sandbox.html` exists in `dist/`
- Check browser console for postMessage errors
- Ensure iframe has `sandbox="allow-scripts"` attribute

### Research Feature Failing

- Verify `tabs` and `scripting` permissions in manifest.json
- Check background service worker logs in `chrome://extensions/`
- Ensure target URL is accessible

### LLM Not Responding

- Verify API key is correctly configured
- Check network requests in DevTools Network tab
- Ensure API endpoint is correct for your provider
