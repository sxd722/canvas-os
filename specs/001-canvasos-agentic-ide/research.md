# Research: CanvasOS Agentic IDE

**Feature Branch**: `001-canvasos-agentic-ide`
**Date**: 2026-03-24

## Research Topics

### 1. Vite Configuration for Chrome Extensions (MV3 CSP)

**Decision**: Use `vite-plugin-web-extension` pattern with manual configuration for CSP compliance.

**Rationale**: 
- Standard Vite builds work for web apps but need customization for Chrome Extensions
- Must output a single bundle without code splitting for popup (simplifies loading)
- `public/` folder files are copied as-is to `dist/`, perfect for sandbox.html

**Configuration Approach**:
```javascript
// vite.config.js
export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'index.html',
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  publicDir: 'public'
})
```

**Alternatives Considered**:
- CRXJS vite plugin: Adds complexity, not needed for this use case
- Webpack: More configuration overhead, Vite is faster for development

### 2. Infinite Canvas Implementation

**Decision**: CSS transform-based panning with React state management.

**Rationale**:
- CSS transforms are GPU-accelerated for smooth panning
- React state tracks viewport offset for node positioning
- Virtualization not needed initially (100 nodes per spec)

**Implementation Pattern**:
```typescript
// Canvas state
interface CanvasState {
  offset: { x: number; y: number };
  scale: number;
  nodes: CanvasNode[];
}

// Transform for panning
style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
```

**Alternatives Considered**:
- HTML5 Canvas API: More complex for React integration, harder to style
- Third-party libraries (React Flow): Adds dependency, overkill for simple panning

### 3. Sandboxed iframe with postMessage

**Decision**: Use `sandbox="allow-scripts"` iframe with structured postMessage protocol.

**Rationale**:
- MV3 CSP blocks eval() in extension pages, but sandboxed iframes are exempt
- `sandbox="allow-scripts"` allows JS execution but blocks same-origin access
- postMessage provides safe communication channel with origin validation

**Message Protocol**:
```typescript
// Parent → Sandbox
interface ExecuteRequest {
  type: 'EXECUTE';
  code: string;
  timeout: number;
}

// Sandbox → Parent
interface ExecuteResult {
  type: 'RESULT';
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}
```

**Alternatives Considered**:
- Web Workers: Cannot access DOM, limited for visualization code
- VM2/NVM: Not available in browser environment

### 4. Content Script Injection for Research Feature

**Decision**: Use `chrome.scripting.executeScript` API programmatically.

**Rationale**:
- MV3 deprecates manifest `content_scripts` for dynamic needs
- Programmatic injection allows targeting specific tabs
- Can inject, extract, and clean up in one flow

**Implementation Pattern**:
```typescript
// In background service worker
const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId },
  func: () => document.body.innerText
});
```

**Alternatives Considered**:
- Manifest-declared content scripts: Always active, wasteful for one-time use
- Message passing to pre-injected scripts: More complex, requires initial injection

### 5. File System Access API

**Decision**: Use `window.showOpenFilePicker()` with FileReader for text content.

**Rationale**:
- Native API for file selection, no extension permissions needed
- FileReader handles text decoding
- Works in extension popup context

**Browser Support**: Chrome 86+ (aligned with MV3 requirements)

**Alternatives Considered**:
- `<input type="file">`: Less flexible, always visible in DOM
- chrome.fileSystem API: Requires additional permissions, overkill for simple file reading

### 6. LLM Integration Pattern

**Decision**: Configurable API endpoint with API key stored in chrome.storage.local.

**Rationale**:
- Users provide their own API key (OpenAI, Anthropic, or custom)
- Key stored securely in extension storage (not hardcoded)
- Endpoint configurable for local/remote LLM services

**Storage Schema**:
```typescript
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  endpoint?: string;
  model: string;
}
```

**Alternatives Considered**:
- Hardcoded backend: Limits user flexibility
- OAuth flow: Complex for MVP, can be added later

## Resolved Clarifications

All technical unknowns from spec have been resolved:
- LLM integration: Configurable API with user-provided key
- File types: Text-based files only for MVP
- Research timeout: 30 seconds maximum
- Sandbox timeout: 10 seconds maximum
