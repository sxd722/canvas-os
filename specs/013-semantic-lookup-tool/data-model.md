# Data Model: Universal Semantic Lookup Tool

**Feature**: 013-semantic-lookup-tool
**Date**: 2026-04-01

## Entities

### SemanticChunk

Represents a unit of extracted content with structural context.
**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| text | string | The actual text content extracted from the element |
| context | string | The closest structural context (heading, table header, or aria-label) |
| selector | string | CSS selector for referencing the element |
| relevanceScore | number | Semantic similarity score (0-1) computed against intent |

### HybridPayload
Represents the tool response containing both information and interactive elements.
**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| information_chunks | SemanticChunk[] | Top 5 static content chunks for by semantic relevance |
| interactive_elements | InteractiveElement[] | Top 5 navigation elements ranked by semantic relevance |

### InteractiveElement
Represents a clickable element (link, button).
**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| text | string | Display text of the element |
| action | string | URL (for links) or click handler reference |
| selector | string | CSS selector for interaction |
| relevanceScore | number | Semantic similarity score (0-1) |

---

## Validation Rules

| Rule | Entity | Validation |
|------|--------|------------|
| VR-001 | SemanticChunk | text must must not be empty |
| VR-002 | SemanticChunk | context must not be "Unlabeled" if missing |
| VR-003 | HybridPayload | information_chunks.length <= 5 |
| VR-004 | HybridPayload | interactive_elements.length <= 5 |
| VR-005 | All elements | Hidden elements (width/height <= 0) must be filtered out |
| VR-006 | all scores | Range 0-1 (may exceed 1 after boost) |

---

## State Transcriptions

```
DOM → Semantic Chunks → Filter Hidden → Score by Relevance → Return Top N
```

### Scoring Flow
```
Elements + Intent → Embedding Scoring → Boost (if applicable) → Sort → Return Top N
```
