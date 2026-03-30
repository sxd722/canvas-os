# Quickstart: MacBook Price Arbitrage DAG Development

**Feature**: 006-macbook-price-arbitrage
**Date**: 2026-03-27

## Prerequisites

- Node.js 18+
- Chrome 86+ with remote debugging enabled
- (Optional) oh-my-openagent running on localhost:8000 for local LLM dev

## Setup

```bash
# Clone and install
git checkout 006-macbook-price-arbitrage
npm install

# Development build (watch mode)
npm run dev
```

## Chrome Setup for Testing

```bash
# Launch Chrome with remote debugging (required for CDP testing)
chrome --remote-debugging-port=9222 --load-extension=./dist
```

## Running the Extension

1. Build the extension: `npm run build`
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select `dist/` folder
5. Click the CanvasOS extension icon in the toolbar

## Testing the Hero Feature

### With DevAgentProvider (oh-my-openagent)

1. Start oh-my-openagent locally:
   ```bash
   # Ensure oh-my-openagent is running on port 8000
   # e.g., python -m openagent.server --port 8000
   ```

2. In the extension settings:
   - Provider: Custom
   - Endpoint: `http://localhost:8000/v1/chat/completions`
   - API Key: (leave empty or use oh-my-openagent's configured key)
   - Model: `default`

3. In the chat, type:
   ```
   Compare MacBook Pro prices between Canada and China
   ```

4. Expected behavior:
   - LLM generates a 5-node DAG plan
   - 4 scrape nodes execute in parallel (Apple CA, Apple CN, exchange rate, HST rate)
   - 1 llm_calc node executes after all 4 complete
   - Canvas shows real-time progress with node status updates
   - Final comparison result appears as a canvas node

### With ProdAPIProvider (real API keys)

1. Configure a real LLM provider in extension settings (OpenAI, Anthropic, or GLM)
2. Same chat prompt as above
3. Same expected behavior — only the LLM backend differs

## Key Files to Modify

| File | Change | Purpose |
|------|--------|---------|
| `src/shared/llm-provider.ts` | NEW | LLMProvider interface + implementations |
| `src/shared/dagSchema.ts` | MODIFY | Add scrape/llm_calc types |
| `src/shared/types.ts` | MODIFY | Add CompletionResult type |
| `src/background/index.ts` | MODIFY | Add SCRAPE_TAB handler |
| `src/popup/services/toolRegistry.ts` | MODIFY | Add scrape/llm_calc handlers in executeNodeWithWorker |
| `src/popup/workers/llmCallWorker.ts` | MODIFY | Refactor to use LLMProvider |
| `src/popup/Canvas/DAGNode.tsx` | MODIFY | Add scrape/llm_calc type labels |

## Verification

```bash
# Run linter
npm run lint

# Run unit tests
npm test

# Run CDP-based integration test
node test-tool-tester.cjs

# Build check (must pass without errors)
npm run build
```

## DAG Plan Structure (Reference)

The expected DAG plan for "Compare MacBook Pro prices between Canada and China":

```json
{
  "nodes": [
    { "id": "apple-ca",   "type": "scrape",   "params": { "url": "https://www.apple.com/ca/shop/buy-mac/macbook-pro" }, "dependencies": [] },
    { "id": "apple-cn",   "type": "scrape",   "params": { "url": "https://www.apple.com.cn/shop/buy-mac/macbook-pro" }, "dependencies": [] },
    { "id": "exchange",   "type": "scrape",   "params": { "url": "https://...exchange-rate..." }, "dependencies": [] },
    { "id": "hst-rate",   "type": "scrape",   "params": { "url": "https://...tax-rates..." }, "dependencies": [] },
    { "id": "calculate",  "type": "llm_calc", "params": { "prompt": "Given $apple-ca, $apple-cn, $exchange, $hst-rate, compare MacBook Pro prices..." }, "dependencies": ["apple-ca", "apple-cn", "exchange", "hst-rate"] }
  ]
}
```
