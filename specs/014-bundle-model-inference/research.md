# Research: Bundle Model for Local Inference

**Feature**: 014-bundle-model-inference  
**Date**: 2026-04-01  
**Status**: Draft

## Research Tasks

### R1: Model Download Location and File structure

**Question**: Where should the download the Xenova/all-MiniLM-L6-v2 model files from Hugging Face Hub?

**Decision**: Download directly from browser using the Hugging Face model download feature

**Rationale**: 
- Simplest approach - download once and commit to repo
- No need for additional scripts or build tools
- Direct download ensures model files are committed early
- Direct download avoids network delays and model availability issues (Hugging Face Hub rate limits, caching issues)
- Chrome Web Store size limits may require alternative distribution

- Users must to install extension manually with the side-loading
- Manual installation is simpler but automated

- Downloaded files are committed to repository for long-term maintainability

**Alternatives considered**:
- **Lazy load at download**: Keep current approach but download from Hugging Face Hub only when model is first needed (requires runtime network, and file size)
- **Pre-download during build**: Add a build step to download model files early, Requires setup but more complex
- **Bundle with extension**: Keep current approach, adds model files to the bundle, increasing extension size from ~1MB to ~80MB

- **Keep current remote download**: Simpler but would require network access during installation and initial load, but simpler to implement

- **Alternative distribution**: Use Chrome Web Store or GitHub releases (larger files allowed, avoid review process)

**Implementation approach**:
```bash
# Download model files from Hugging Face
# Create directory structure
mkdir -p public/models/Xenova/all-MiniLM-L6-v2/onnx

# Download quantized model (smallest)
wget -q https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx \
  -O https://huggingface.co/Xenova/all-MiniLM-L6-v2/raw/main.onnx \
  --output-document ./onnx/model_quantized.onnx
``

Download each file:
```bash
# Example download script
mkdir -p public/models/Xenova/all-MiniLM-L6-v2
cd public/models/Xenova/all-MiniLM-L6-v2
wget -q https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx
unzip -q https://huggingface.co/Xenova/all-MiniLM-L6-v2/archive.zip
mv public/models/Xenova/all-MiniLM-L6-v2.onnx/model_quantized.onnx public/models/Xenova/all-MiniLM-L6-v2/onnx

# Verify download
ls -la public/models/Xenova/all-MiniLM-L6-v2
```

### R2: Model loading Strategy

**Question**: How should Transformers.js be configured to load from local bundled files instead of downloading from Hugging Face Hub?

**Decision**: Use `local_files_only: true` option with `quantized: true` in pipeline configuration

**rationale**: 
- **Simplest approach**: Single configuration change in `getEmbeddingPipeline()`
- **No code duplication**: Minimal changes to existing function
- **Graceful fallback**: TF-IDF already in place if local files missing
- **Performance**: `local_files_only: true` prevents remote download overhead, Loading from local disk should be faster (eliminates network round-trip time)

- **CSP compliance**: No external CDN or inline scripts, uses standard Transformers.js loading mechanism

**Alternatives considered**:
- **Lazy load + download**: Keep current approach but add download step, but requires separate download script or CI pipeline
- **Pre-download**: Add build step to download before bundling, slower first-time load
- **Bundle + download**: Download once and commit to repo, simpler but more steps
- **Remote fetch**: Use `fetch()` from Hugging Face API, faster than local file loading but adds complexity

**Implementation approach**:
```typescript
// In src/popup/services/semanticExtractor.ts

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

async function getEmbeddingPipeline(): Promise<Awaited<ReturnType<typeof pipeline>> | null> {
  if (embeddingPipeline) return embeddingPipeline;
  if (modelLoadFailed) return null;

  if (modelLoading) {
    return new Promise((resolve) => {
      const check = () => {
        if (embeddingPipeline) resolve(embeddingPipeline);
        else if (modelLoadFailed) resolve(null);
        else setTimeout(check, 100);
      };
      check();
    });
  }

  modelLoading = true;
  try {
    console.log(`[semanticExtractor] Loading embedding model: ${MODEL_ID}...`);
    
    // OLD: Remote download
    // embeddingPipeline = await pipeline('feature-extraction', MODEL_ID, {
      quantized: true,
    } as Record<string, unknown>);
    
    // NEW: Local files only
    embeddingPipeline = await pipeline('feature-extraction', MODEL_ID, {
      quantized: true,
      local_files_only: true,  // Enable local file loading
      progress_callback: (progress) => {
        if (progress.status === 'progress') {
          const percent = (progress.loaded * 100) / progress.total;
          console.log(`[semanticExtractor] Model loading: ${percent.toFixed(1)}% complete`);
        }
      }
    } as Record<string, unknown>);
    
    console.log('[semanticExtractor] Embedding model loaded successfully');
    return embeddingPipeline;
  } catch (err) {
    console.warn('[semanticExtractor] Failed to load embedding model, falling back to TF-IDF:', err);
    modelLoadFailed = true;
    return null;
  } finally {
    modelLoading = false;
  }
}
```

### R3: Build Validation Approach

**Question**: How should we validate that model files are present before bundling?

**Decision**: Add build-time validation using Vite plugin

**Rationale**: 
- **Catches errors early**: Fails during build if files missing
- **Automated**: Vite plugin can be added to build process without modifying build scripts
- **Clear error messages**: Error messages clearly indicate which files are missing
- **Easy to implement**: Simple plugin that checks file existence and file size

**Implementation approach**:
```javascript
// vite.config.js - add build validation
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        scraper: resolve(__dirname, 'src/content/scraper.ts'),
        webview_bridge: resolve(__dirname, 'src/content/webview_bridge.js'),
        executor: resolve(__dirname, 'src/sandbox/executor.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
        if (chunkInfo.name === 'scraper') return 'scraper.js';
        if (chunkInfo.name === 'webview_bridge') return 'webview_bridge.js';
        if (chunkInfo.name === 'executor') return 'executor.js';
        return 'assets/[name]-[hash].js';
      },
      chunkFileNames: 'assets/[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash].[ext]'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
```

### R4: Version Compatibility

**Question**: Should we pin Transformers.js to a specific version?

**Decision**: Pin Transformers.js to ^2.17.1 (current version in package.json)

**Rationale**: 
- **Stability**: Using a known, stable version ensures model compatibility
- **Model format compatibility**: The version has been tested with the ONNX model format
- **No breaking changes**: Avoids potential issues with newer, incompatible versions
- **Upgrade path**: Document upgrade process in research.md when needed

**Implementation approach**: Update package.json if needed, add note about version pinning

### R5: Model File Size and Integrity

**Question**: Should we verify model file integrity after download?

**Decision**: Add a manual verification step to check file size and existence

**Rationale**:
- **Corruption detection**: Ensures downloaded files aren't corrupted
- **Early failure**: Catches issues before build, rather than runtime
- **Documentation**: Document expected file sizes in research.md

**Implementation approach**:
```bash
# After downloading, verify file sizes
MODEL_DIR="public/models/Xenova/all-MiniLM-L6-v2/onnx"
EXPECTED_FILES=(
  "model_quantized.onnx",
  "tokenizer.json"
)

for file in expected_files; do
  file_path="$MODEL_DIR/$file"
  if [ ! -f "$file_path" ]; then
    echo "ERROR: Missing model file: $file_path"
    exit 1
  fi
  
  file_size=$(stat -f "$file_path").size
  echo "✓ $file_path: $(file_size / 1024 / 1024).toFixed(2)) MB"
done
```

### R6: Performance Impact
**Question**: Will loading ~80MB model into memory cause performance issues?

**Decision**: Load model once and reuse; use batched processing for large element sets

**Rationale**:
- **Singleton pattern**: Model loads once per session, cached in memory
- **Batch processing**: Process multiple elements in batches to avoid memory overload
- **Memory management**: Monitor memory usage and clear warnings if approaching limits
- **Graceful degradation**: Fall back to TF-IDF if model loading fails or not memory issues

**Implementation approach**: Monitor model loading in semanticExtractor.ts, consider adding memory monitoring.

## Dependencies

### R7: Transformers.js API Usage
**Question**: Should we use the Transformers.js APIs or methods?

**Decision**: Use `pipeline()` API with `feature-extraction` task and `local_files_only` option

**Rationale**:
- **Standard API**: Pipeline API is the well-documented and stable method
- **Local file support**: `local_files_only` option available in Transformers.js
- **Minimal changes**: Only configuration changes needed, not API changes

**Implementation approach**: Keep existing API usage, add configuration options.

### R8: Chrome Web Store Size Limits
**Question**: How do we handle the ~80MB increase in extension size for Chrome Web Store?

**Decision**: Document the in assumptions; consider GitHub Releases for distribution if needed

**Rationale**:
- **Transparency**: Be upfront about size increase with users
- **Chrome Web Store limits**: 50MB initial upload, 100MB for updates
- **Alternative distribution**: GitHub Releases allows larger files
- **User choice**: Users can install from store or download manually

**Implementation approach**: Add to assumptions section in spec.md; document in quickstart.md

### R9: Fallback Mechan Testing
**Question**: How do we verify the fallback mechanism works correctly?

**Decision**: Test with network disconnected, corrupted model files, and model loading failures

**Rationale**:
- **Comprehensive testing**: Ensure TF-IDF fallback works in all scenarios
- **User experience**: Users should still get results even if model fails
- **Error logging**: Log fallback events for debugging

**Implementation approach**: Add test scenarios to quickstart.md

### R10: Documentation
**Question**: What documentation should we add?

**Decision**: Update AGENTS.md with feature notes, create setup guide in quickstart.md

**Rationale**:
- **AGENTS.md**: Document model bundling approach and file locations, and usage
- **quickstart.md**: Provide step-by-step setup and testing instructions
- **README**: Update main README if needed

**Implementation approach**: Update AGENTS.md, create quickstart.md
