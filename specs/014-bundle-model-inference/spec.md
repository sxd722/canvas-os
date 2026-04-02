# Feature Specification: Bundle Model for Local Inference

**Feature Branch**: `014-bundle-model-inference`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "Please download the model and bundle it in the repository, and build pipelines to model inference for webview tool calls"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bundle Model for Offline Use (Priority: P1)

As a developer, I need the semantic extraction model bundled locally in the extension so that users don't experience network delays or require internet connectivity after installation.

**Why this priority**: Core infrastructure - enables offline operation and eliminates runtime model downloads that degrade user experience.

**Independent Test**: Can be fully tested by installing the extension offline and verifying that semantic extraction works without any network requests.

**Acceptance Scenarios**:

1. **Given** the extension is freshly installed, **When** a webview tool call triggers semantic extraction, **Then** the model loads from local bundled files without network requests
2. **Given** the extension is offline, **When** semantic extraction is triggered, **Then** the model successfully loads and performs inference
3. **Given** the model files exist in the bundle, **When** the extension loads, **Then** no console warnings about model download failures appear

---

### User Story 2 - Semantic Inference Pipeline (Priority: P1)

As a user, I need semantic extraction to use the bundled model for ranking webview content so that I get fast, accurate semantic matching without network delays.

**Why this priority**: Core functionality - enables the universal semantic lookup tool to work efficiently.

**Independent Test**: Extract content from a webview and verify that semantic ranking completes with bundled model inference.

**Acceptance Scenarios**:

1. **Given** a webview has loaded content, **When** the semantic extractor processes elements, **Then** the bundled model generates embeddings for ranking
2. **Given** the bundled model is loaded, **When** semantic extraction runs, **Then** results appear in under 500ms for typical page content (50-100 elements)
3. **Given** the model fails to load, **When** semantic extraction is triggered, **Then** the system falls back to TF-IDF scoring without errors

---

### User Story 3 - Build Pipeline Validation (Priority: P2)

As a developer, I need the build process to validate that model files are present and properly configured so that broken builds are caught early.

**Why this priority**: Developer experience - prevents deployment of extensions with missing model files.

**Independent Test**: Attempt a build with missing model files and verify the build fails with a clear error message.

**Acceptance Scenarios**:

1. **Given** model files are missing from the expected location, **When** the build runs, **Then** the build fails with an error message indicating missing model files
2. **Given** model files are present, **When** the build completes, **Then** the dist/ folder contains the model files in the correct structure
3. **Given** the build completes successfully, **When** the extension is loaded, **Then** the model path configuration points to the bundled location

---

### Edge Cases

- What happens when the model file is corrupted or incomplete?
  - System falls back to TF-IDF scoring and logs a warning
- How does system handle insufficient disk space for model loading?
  - Model loading fails gracefully, system uses TF-IDF fallback
- What happens if Transformers.js version is incompatible with the bundled model format?
  - Build process validates model compatibility during development
- How does the system behave when webview content is extremely large (1000+ elements)?
  - Model inference batches elements to avoid memory issues

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST download the Xenova/all-MiniLM-L6-v2 ONNX model files (quantized version)
- **FR-002**: Model files MUST be stored in the public/models/ directory for bundling
- **FR-003**: Transformers.js pipeline MUST be configured to use local model files with `local_files_only: true`
- **FR-004**: Build process MUST validate model file presence before completing the build
- **FR-005**: Semantic extractor MUST use bundled model for inference on webview content
- **FR-006**: System MUST fall back to TF-IDF scoring if model loading fails
- **FR-007**: Model MUST be loaded once and reused across multiple webview tool calls (singleton pattern)
- **FR-008**: Build output MUST include model files in the extension bundle in the correct directory structure

### Key Entities

- **ModelBundle**: Represents the downloaded ONNX model (~80MB quantized) and tokenizer files stored locally in the extension at public/models/Xenova/all-MiniLM-L6-v2/
- **InferencePipeline**: The Transformers.js feature-extraction pipeline configured to load from local files and generate 384-dimensional embeddings
- **SemanticExtractionResult**: The output containing ranked information_chunks and interactive_elements with relevance scores from cosine similarity

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Model loads from local bundled files without any network requests (verified via browser DevTools Network tab showing zero external requests for model files)
- **SC-002**: Semantic inference completes in under 500ms for typical webview content (50-100 elements) on standard hardware
- **SC-003**: Build process validates model file presence and fails with clear error message if files are missing
- **SC-004**: Extension functions completely offline after initial installation (no network connectivity required for semantic extraction)
- **SC-005**: Model loading happens only once per extension session, with subsequent calls reusing the loaded pipeline (verified via console logging)
- **SC-006**: Extension bundle size increase is documented and acceptable (~80MB added to bundle)

## Assumptions

- Model size (~80MB quantized ONNX) is acceptable for extension bundle size limits
- Chrome Web Store extension size limit (currently 50MB for first upload, 100MB for updates) may require alternative distribution methods or user acceptance of larger download
- Users have sufficient disk space for the larger extension bundle
- Transformers.js version is pinned in package.json to ensure compatibility with downloaded model format
- Model is downloaded once during development and committed to the repository (not downloaded at build time)
- No model fine-tuning or updates needed - using pre-trained Xenova/all-MiniLM-L6-v2 as-is
- Browser Cache API is no longer needed for model storage since files are bundled in the extension
- The quantized model provides sufficient accuracy for semantic ranking use case
