# Quick Start: Bundle Model for Local Inference

**Feature**: 014-bundle-model-inference  
**Date**: 2026-04-01

## Prerequisites

- Chrome browser with extension installed
- Extension loaded from `dist/` directory
- Node.js 18+ installed
- Model files downloaded (see setup steps below)

## Setup Steps

### 1. Download Model Files

```bash
# Run the download script
node scripts/download-model.js

# Expected output:
# Downloading Xenova/all-MiniLM-L6-v2 model files...
# ✓ Model downloaded to public/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx (XX.XX MB)
# ✓ Tokenizer downloaded to public/models/Xenova/all-MiniLM-L6-v2/onnx/tokenizer.json (XX.XX KB)
# Model files ready for bundling
```

### 2. Build Extension

```bash
npm run build
```

This will:
1. Bundle the extension with model files
2. Run build validation (checks model files exist)
3. Output to `dist/` directory

### 3. Load Extension in Chrome

1. Open Chrome with `--remote-debugging-port=9222`
2. Load extension from `dist/` directory
3. Navigate to any webpage

### 4. Test Semantic Extraction

```javascript
// Open DevTools console and Network tab
// Trigger a webview tool call
// Expected behavior:
// - No network requests to Hugging Face Hub
// - Model loads from local files
// - Semantic extraction completes in <500ms
// - Results appear in console

## Testing Scenarios

### Test 1: Offline Operation

1. Disconnect from internet
2. Trigger webview tool call
3. **Expected**: Semantic extraction works without network

### Test 2: Model Loading Failure

1. Temporarily rename model files
2. Trigger webview tool call
3. **Expected**: Falls back to TF-IDF scoring with warning

### Test 3: Build Validation

1. Remove model files from public/models/
2. Run `npm run build`
3. **Expected**: Build fails with error message about missing model files

## Performance Testing

### Memory Usage

Monitor browser DevTools → Memory tab during semantic extraction:
- Initial load: ~80MB model into memory
- Per inference: ~5-10MB additional
- Total memory: ~90MB expected

### Inference Speed

For 50-100 elements:
- **Target**: <500ms end-to-end
- **Acceptance**: <1000ms with warning

## Verification Checklist

- [ ] Model files exist in public/models/Xenova/all-MiniLM-L6-v2/onnx/
- [ ] File sizes match expected values (~80MB model, ~1KB tokenizer)
- [ ] No network requests to Hugging Face Hub during inference
- [ ] Semantic extraction completes in <500ms for typical pages
- [ ] TF-IDF fallback works when model fails to load
- [ ] Build fails if model files are missing
- [ ] AGENTS.md updated with feature notes

## Troubleshooting

### Model fails to load
- **Symptom**: Console warning about model loading failure
- **Check**: Verify model files exist and are valid
- **Check**: Check file sizes match expected values
- **Check**: Check Transformers.js version compatibility

### Slow inference
- **Symptom**: Inference takes >1 second
- **Check**: Reduce batch size in semanticExtractor.ts
- **Check**: Monitor memory usage, consider batching approach
- **Check**: Check for large element sets (1000+ elements)

### Build fails with model files missing
- **Symptom**: Build error about missing model files
- **Check**: Run `node scripts/download-model.js` to download files
- **Check**: Verify files are in correct location (public/models/)
- **Check**: Check Vite config includes publicDir: 'public'

## Notes

- **File Size**: Model adds ~80MB to extension bundle size
- **Chrome Web Store**: Initial upload limited to 50MB; updates up to 100MB
- **Alternative**: Consider GitHub Releases for larger extensions
- **Offline Capability**: Extension works completely offline after installation
- **Performance**: Model loads once per session and is reused for all webview calls
