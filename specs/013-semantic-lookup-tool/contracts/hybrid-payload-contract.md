# Hybrid Payload Contract

**Feature**: 013-semantic-lookup-tool
**Date**: 2026-04-01

## Overview

This document defines the contract for the hybrid payload returned by the webview browsing agent tool.

## Message Types

### CONTENT_RESPONSE (Modified)

**Direction**: Iframe (webview_bridge.js) → Parent (popup)
**Purpose**: Return semantic extraction results
**Changes**:
- Renamed `elements` to `information_chunks` (static content) and `interactive_elements` (navigation elements)
- Both arrays now contain relevance-scored items

```typescript
interface ContentResponseMessage {
  type: 'CONTENT_RESPONSE';
  nonce: string;
  extraction: {
    url: string;
    title: string;
    summary: string;
    information_chunks: InformationChunk[];  // NEW: was interactive_elements
    interactive_elements: InteractiveElement[]; // New: was extractedAt: number;
    extractionMethod: 'semantic';
    extractedAt: number;
    success: boolean;
    error?: string;
  };
}
```

## InformationChunk (New)
Represents a static text content with structural context.
**Purpose**: Enable the LLM to answer questions based on page content.
```typescript
interface InformationChunk {
  text: string;           // The actual text content
  context: string;        // Structural context (heading, header, or aria-label)
  selector: string;       // CSS selector for reference
  relevanceScore: number; // Cosine similarity to intent (0-1 range)
}
```

## InteractiveElement (New)
Represents clickable navigation elements.
**Purpose**: Enable the LLM to take actions on the page.
```typescript
interface InteractiveElement {
  text: string;           // The element text/label
  action: string;         // URL for links, click handler description for buttons
  selector: string;       // CSS selector for reference
  relevanceScore: number; // Cosine similarity to intent (0-1 range)
}
```

## Visibility Rules
Elements are included only if they pass visibility check:
**Visibility Check**:
```javascript
const rect = element.getBoundingClientRect();
const isVisible = rect.width > 0 && rect.height > 0;
```

**Excluded Elements**:
- `display: none` elements
- Elements with `visibility: hidden`
- Off-screen elements
- Elements inside hidden containers

## Semantic Scoring
All chunks and interactive elements are scored by cosine similarity to the user's intent using Transformers.js embeddings.
**No boost logic**: The previous price-specific boost logic is removed - all items are scored purely by semantic similarity.
**Scoring Process**:
1. Embed user intent
2. Embed each chunk/element text + context
3. Calculate cosine similarity
4. Sort by relevance score (descending)
5. Return top 5 items per array
