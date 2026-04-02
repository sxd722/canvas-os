# Implementation Plan: Bundle Model for Local Inference

**Branch**: `014-bundle-model-inference` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-bundle-model-inference/spec.md`

## Summary

Bundle the Xenova/all-MiniLM-L6-v2 ONNX model (~80MB quantized) directly in the extension repository to enable offline semantic extraction for webview tool calls. Configure Transformers.js to load from local bundled files instead of remote Hugging Face Hub, and build validation pipelines to ensure model files are present before bundling.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022) + JavaScript ES2022
**Primary Dependencies**: 
- @xenova/transformers ^2.17.1 (existing)
- Vite 5.x (build tool)
- React 18+ (UI framework)
- Chrome Extensions MV3 APIs

**Storage**: 
- File system: Model files in `public/models/Xenova/all-MiniLM-L6-v2/`
- chrome.storage.session (ephemeral state for model loading status)

**Testing**: 
- Vitest (unit tests)
- Chrome DevTools Protocol (CDP) on port 9222 for functional testing

**Target Platform**: 
- Chrome Browser Extension (MV3)
- Service Worker + Popup UI + Content Scripts

**Project Type**: Chrome Extension with embedded webviews

**Performance Goals**: 
- Model inference <500ms for 50-100 elements
- Model loading <2s on first call
- No network requests after installation

**Constraints**: 
- Extension bundle size ~80MB increase (quantized ONNX model)
- Chrome Web Store size limits: 50MB initial upload, 100MB updates
- CSP-compliant (no remote code loading)
- Offline-capable after installation

**Scale/Scope**: 
- Single model per extension instance
- Model loaded once and reused across webview calls
- Supports 50-100 elements per extraction batch

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. MV3 CSP Compliance ✅
- **Model files bundled locally**: All model files will be in `public/models/` directory
- **No remote code execution**: Transformers.js loads model from local files
- **CSP-compliant**: No `eval()` or `new Function()` - all code is bundled

### II. Local Build Pipeline ✅
- **Vite build**: Model files copied from `public/` to `dist/` during build
- **Dependencies declared**: @xenova/transformers already in package.json
- **TypeScript**: Build uses `tsc && vite build`

### III. Remote Debugging Verification ✅
- **CDP testing**: Can verify model loading via DevTools Protocol
- **Network tab verification**: Can confirm zero external requests for model files

### IV. Component Architecture ✅
- **Functional approach**: `getEmbeddingPipeline()` uses singleton pattern
- **Service isolation**: Model loading in `semanticExtractor.ts` service
- **State locality**: Model loading state tracked in module-level variables

### V. Extension API Isolation ✅
- **Service Worker compatible**: Model loading runs in extension context
- **No localStorage**: Uses chrome.storage.session for status (if needed)
- **Permissions**: No additional permissions required

**GATE STATUS**: ✅ All gates passed. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/014-bundle-model-inference/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - model download and configuration
├── data-model.md        # Phase 1 output - model bundle structure
├── quickstart.md        # Phase 1 output - testing guide
└── contracts/
    └── model-loader-contract.md  # Model loading interface contract
```

### Source Code (repository root)

```text
public/
└── models/
    └── Xenova/
        └── all-MiniLM-L6-v2/
            ├── onnx/
            │   └── model_quantized.onnx  # Quantized ONNX model (~80MB)
            ├── tokenizer.json           # Tokenizer configuration
            ├── config.json              # Model configuration
            └── preprocessor_config.json  # Preprocessing settings

src/
├── popup/
│   └── services/
│       └── semanticExtractor.ts  # MODIFY: Configure local model loading
├── background/
│   └── index.ts               # No changes needed
└── shared/
    └── types/
        └── model.ts             # ADD: Model loading status types (optional)

tests/
└── integration/
    └── model-loading.test.ts   # ADD: Test model loads from local files

vite.config.js                  # MODIFY: Add build validation for model files
```

**Structure Decision**: Option 1 - Single project structure. Model files added to `public/models/` directory which Vite automatically copies to `dist/` during build. No new source directories needed, only modifications to existing `semanticExtractor.ts` and `vite.config.js`.

## Complexity Tracking

> **No violations detected** - All gates passed. Model bundling follows standard Vite public directory pattern.

