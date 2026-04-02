# Research: Universal Semantic Lookup Tool

# Implementation Plan: Semantic Lookup Tool

# Tasks: Universal Semantic Lookup Tool
# Tasks: Semantic Lookup Tool
# Research: Semantic Lookup Tool

# Research: Semantic Lookup Tool

**Feature**: 013-semantic-lookup-tool
**Date**: 2026-04-01

## Research Tasks

### R1: Semantic Chunk Structure design

**Question**: What's the best way to pair text content with structural context for DOM traversal?

**Decision**: Walk up DOM tree from closest heading (h1-h6), table header (th), or aria-label

**Rationale**:
- DOM tree traversal is efficient and- Closest meaningful context provides semantic understanding
- Works for any type of structured content

**Alternatives considered**:
- Parse only text nodes directly (misses context)
- Use fixed patterns (currency symbols, price keywords)
- Combine text and context in single object (misses semantic relationship)

**Implementation approach**:
```javascript
function findStructuralContext(element) {
  var context = '';
  var current = element;
  
  // Walk up to find closest heading
  while (current && current !== document.body) {
    var tagName = current.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) {
      context = current.textContent.trim();
      break;
    }
    
    // Check for table header context
    if (tagName === 'TD' || tagName === 'TH') {
      var row = current.closest('tr');
      var headerCell = row ? row.querySelector('th');
      if (headerCell) {
        context = headerCell.textContent.trim();
        break;
      }
    }
    
    // Check for aria-label
    var ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      context = ariaLabel;
      break;
    }
  }
  
  return context || 'Unlabeled';
}
```

**Alternatives considered**:
- Only extract text nodes, lose context
- Only look for specific elements (headings only)
- Lose flexibility

---

### R2: Hybrid Payload structure design

**Question**: What's the best format for returning both static information and interactive elements to the LLM?

**decision**: Return a hybrid payload with two separate arrays

  - `information_chunks`: Top 5 semantic chunks (for answering questions)
  - `interactive_elements`: Top 5 clickable elements (for navigation)

**Rationale**:
- Separates concerns: LLMs need different types of content
- Keeps payload focused on most relevant items
- Enables single tool response for support both answering and taking actions

**Alternatives considered**:
- Single array with all content (less focused, harder to process)
- Return all content in single object (harder to filter)

---

### R3: Cosine similarity implementation

**Question**: Should we use from TF-IDF to pure embedding-based cosine similarity via Transformers.js?

**decision**: Keep existing Transformers.js embedding approach
- Already implemented and working
- Provides semantic understanding for embeddings
- Cosine similarity proven to be for general-purpose information lookup

**Rationale**:
- Transformers.js is already integrated in the project
- Well-tested for semantic tasks
- Runs in-browser without server round-trip
- Good balance of performance vs. accuracy

**Alternatives considered**:
- TF-IDF only (less accurate, no semantic understanding)
- BM25/sentence-transformers (heavier, slower)
- Custom keyword extraction (domain-specific, fragile)

---

## Summary

All research questions resolved. Implementation approach:
1. Semantic chunks pair text content with closest structural context (heading, table header, aria-label)
2. Hybrid payload returns separate arrays for information chunks and interactive elements
3. Use existing Transformers.js cosine similarity for semantic ranking
