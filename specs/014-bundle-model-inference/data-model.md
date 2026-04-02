# Data Model: Bundle Model for Local Inference

**Feature**: 014-bundle-model-inference  
**Date**: 2026-04-01  
**Status**: Draft

## Entities

### SemanticExtractionResult

Represents the output of the semantic extraction process.

**Fields**:
- `information_chunks`: Array of semantic chunks with context and relevance scores
- `interactive_elements`: Array of interactive elements (links, buttons, inputs)
- `extractionMethod`: 'semantic-chunk' (always)
- `timestamp`: Date when extraction occurred

- `success`: boolean indicating extraction success
- `fallback`: boolean indicating if TF-IDF was used instead of model

**Relationships**:
- Produced by `extractSemanticChunks()` in webview_bridge.js
- Consumed by semanticExtractor.ts for ranking

### SemanticChunk

Represents a text element paired with structural context

**Fields**:
- `id`: Unique identifier (e.g., 'chunk-0', 'chunk-1')
- `text`: Text content (max 200 characters)
- `context`: Array of context strings (headings, aria-labels, table headers)
- `selector`: CSS selector for the element
- `xpath`: XPath for the element
- `boundingRect`: Element position and dimensions
- `relevanceScore`: Cosine similarity score (0.0 to 1.0)

**relationships**:
- Extracted from DOM elements (p, span, td, li)
- Paired with context from `findStructuralContext()`
- Scored by Transformers.js model

### ModelBundle

Represents the downloaded ONNX model files in the extension

**Fields**:
- `modelPath`: Local path to model files (e.g., '/models/Xenova/all-MiniLM-L6-v2/onnx/')
- `tokenizerPath`: Local path to tokenizer config
- `modelSize`: File size in bytes (~80MB quantized)
- `loaded`: Boolean indicating if model is loaded in memory
- `loadTime`: Time taken to load model (ms)

**relationships**:
- Downloaded from Hugging Face Hub
- Stored in public/models/ directory
- Loaded by Transformers.js pipeline

### InferencePipeline

Represents the Transformers.js pipeline configured for local model loading

**Fields**:
- `pipeline`: The Transformers.js pipeline instance
- `modelId`: 'Xenova/all-MiniLM-L6-v2'
- `localFilesOnly`: true (always)
- `quantized`: true (always)
- `status`: 'unloaded' | 'loading' | 'ready' | 'failed'

**State Transitions**:
1. `unloaded` → Initial state
2. `loading` → When `getEmbeddingPipeline()` is called
3. `ready` → After successful model load
4. `failed` → If model load fails, fallback to TF-IDF

**relationships**:
- Created by `getEmbeddingPipeline()`
- Uses ModelBundle files for loading
- Generates embeddings for SemanticChunk ranking

## Validation Rules

### SemanticChunk Validation
- `text` must must be not be empty and `text.length >= 3`
- `text` must be unique (deduplication via Set)
- `relevanceScore` must be between 0.0 and 1.0
- `boundingRect` width and height > 0 (hidden elements filtered)

### ModelBundle Validation
- `modelPath` must exist and point to valid files
- `tokenizerPath` must exist and point to valid files
- File sizes must match expected values (documented in research.md)
- Files loaded successfully during build validation

### InferencePipeline Validation
- `pipeline` must not be null when status is 'ready'
- `localFilesOnly` must be true
- `quantized` must be true
- Model loads only once per session (singleton pattern)

## Notes
- **Storage**: Model files stored in public/models/ (bundled with extension)
- **Memory**: Model loaded once and reused across all webview calls
- **Fallback**: TF-IDF scoring used if model loading fails
- **Performance**: Target <500ms inference for 50-100 elements
