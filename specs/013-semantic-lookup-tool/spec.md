# Feature Specification: Semantic Lookup Tool

# Feature Specification: Universal Semantic Information Lookup Tool

**Feature Branch**: `013-semantic-lookup-tool`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "Generalize the webview browsing agent into a universal semantic information lookup tool, removing all hardcoded price-extraction logic. 1) In the specification (spec.md), rename and generalize all 'Price Comparison' references to 'Generic Information Extraction'. 2) Redesign the extraction algorithm in src/content/webview_bridge.js: it must walk the DOM to create 'Semantic Chunks' by pairing meaningful text nodes (p, span, td) with their closest structural context (h1-h6 headings, th headers, or aria-labels). Remove all hardcoded currency symbol checks ($, ¥, etc.). 3) Update src/popup/services/semanticExtractor.ts and the embedding worker to embed these Semantic Chunks against the LLM's `intent`. 4) The tool payload returned to the LLM must be a hybrid containing two arrays: `information_chunks` (the Top 5 most semantically relevant static text blocks for answering the query) and `interactive_elements` (the Top 5 most relevant links/buttons for navigation), scored purely via cosine similarity using Transformers.js."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract Semantic Chunks with Context (Priority: P1)

When browsing any webpage, the extraction system identifies meaningful text content and pairs it with its surrounding structural context (headings, table headers, or accessibility labels). This creates semantically rich chunks that can be matched against user queries.

**Why this priority**: This is the core transformation - moving from domain-specific (price) extraction to a general-purpose semantic extraction that works for any type of information.

**Independent Test**: Can be fully tested by loading a page with structured content (headings, paragraphs, tables) and verifying that extracted chunks include both the text content and its structural context.

**Acceptance Scenarios**:

1. **Given** a page with `<h2>Product Details</h2><p>The price is $99</p>`, **When** extraction runs, **Then** a semantic chunk is created with text "The price is $99" and context "Product Details"
2. **Given** a table with `<th>Name</th><td>John</td>`, **When** extraction runs, **Then** a semantic chunk is created with text "John" and context "Name"
3. **Given** a page with `aria-label="Submit form"`, **When** extraction runs, **Then** the aria-label is captured as structural context

---

### User Story 2 - Score Chunks by Semantic Relevance (Priority: P1)

When the user provides an intent (e.g., "Find contact information"), the system ranks all extracted semantic chunks by their semantic similarity to the intent, returning the most relevant ones for answering the query.

**Why this priority**: Semantic ranking ensures users get the most relevant information without manual filtering.

**Independent Test**: Can be fully tested by providing various intents and verifying that returned chunks are semantically relevant to those intents.

**Acceptance Scenarios**:

1. **Given** intent "Find the CEO's email" and chunks about CEO contact info, **When** scoring runs, **Then** CEO-related chunks rank higher than unrelated content
2. **Given** intent "What are the features?" and chunks about product features, **When** scoring runs, **Then** feature-related chunks rank highest
3. **Given** intent "How do I contact support?" and chunks about support options, **When** scoring runs, **Then** support-related chunks appear in top results

---

### User Story 3 - Return Hybrid Navigation Payload (Priority: P2)

When the LLM requests information from a webpage, the system returns a hybrid payload containing both static information chunks (for answering questions) and interactive elements (for taking actions), each independently ranked by semantic relevance.

**Why this priority**: This enables the LLM to both understand page content and navigate effectively in a single tool response.

**Independent Test**: Can be fully tested by browsing a page and verifying the the returned payload contains both `information_chunks` and `interactive_elements` arrays.

**Acceptance Scenarios**:

1. **Given** a page with information and links, **When** extraction completes, **Then** payload contains both `information_chunks` and `interactive_elements`
2. **Given** intent requiring action, **When** payload is returned, **Then** `interactive_elements` includes relevant navigation options
3. **Given** intent requiring information, **When** payload is returned, **Then** `information_chunks` includes relevant static content

---

### Edge Cases

- What happens when a page has no meaningful text nodes? → Return empty information_chunks array
- What happens when a page has no interactive elements? → Return empty interactive_elements array
- What happens when text has no structural context? → Use "Unlabeled" as context
- What happens with deeply nested structures? → Walk up to find closest meaningful context

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST extract semantic chunks by pairing text content (p, span, td) with their closest structural context (h1-h6, th, aria-labels)
- **FR-002**: System MUST NOT use hardcoded domain-specific patterns (currency symbols, price keywords, etc.)
- **FR-003**: System MUST rank semantic chunks by cosine similarity to the user's intent
- **FR-004**: System MUST return a hybrid payload with two arrays: `information_chunks` (top 5 static content) and `interactive_elements` (top 5 navigation elements)
- **FR-005**: System MUST score both information chunks and interactive elements independently using the same semantic similarity algorithm
- **FR-006**: System MUST filter out hidden elements (width/height <= 0) from all extraction

### Key Entities
- **SemanticChunk**: Represents a unit of extracted content containing `text` (the actual content), `context` (structural context like heading/header), `selector` (for reference), and `relevanceScore` (computed against intent)
- **HybridPayload**: The tool response structure containing `information_chunks` array and `interactive_elements` array, each with relevance scores
- **InteractiveElement**: Represents clickable elements (links, buttons) with `text`, `action` (url/click handler), and `relevanceScore`

## Success Criteria *(mandatory)*
### Measurable Outcomes
- **SC-001**: Users can extract relevant information from any webpage type (news, e-commerce, documentation, social media) with at least 80% accuracy
- **SC-002**: Information chunks include both content and structural context in at least 90% of extractions
- **SC-003**: Semantic ranking places intent-relevant chunks in top 5 results at least 85% of the time
- **SC-004**: Hybrid payload enables LLMs to answer questions AND take actions on the same page without additional tool calls
- **SC-005**: No hardcoded domain patterns remain in the extraction algorithm (verified by code review)
- **SC-006**: Extraction completes within 100ms for typical web pages

## Assumptions
- Transformers.js embeddings provide sufficient semantic understanding for general-purpose information lookup
- 5 items per array is sufficient for most use cases (can be adjusted if needed)
- Structural context is more valuable than isolated text for understanding content
- Hidden element filtering remains important regardless of extraction type
- Cosine similarity is the appropriate metric for semantic relevance
