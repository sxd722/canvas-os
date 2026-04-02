# Contract: Model Configuration

**Feature**: 014-bundle-model-inference  
**Date**: 2026-04-01  
**Type**: Internal Configuration Contract

## Overview

This contract defines how the semanticExtractor module should be configured to load the bundled ONNX model instead of downloading from Hugging Face Hub.

## Configuration Interface

### Required Changes

The semanticExtractor.ts MUST configure Transformers.js pipeline to use local files:

```typescript
interface ModelConfig {
  modelPath: string;       // Path to bundled model files
  quantized: boolean;       // Use quantized model
  localFilesOnly: boolean;  // Load from local files only
}
```

### Configuration Values
```typescript
const MODEL_CONFIG: ModelConfig = {
  modelPath: '/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx',
  quantized: true,
  localFilesOnly: true
};
```

### Implementation in semanticExtractor.ts
```typescript
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
    console.log(`[semanticExtractor] Loading embedding model from ${MODEL_CONFIG.modelPath}...`);
    embeddingPipeline = await pipeline('feature-extraction', MODEL_ID, {
      quantized: MODEL_CONFIG.quantized,
      local_files_only: MODEL_CONFIG.localFilesOnly,
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

## Behavior
- **Success path**: Model loads from local files, console logs show success
- **Failure path**: Falls back to TF-IDF, logs warning message
- **Network requests**: None (all files local)
- **Loading time**: ~2-5 seconds on first call, instant on subsequent calls

## Testing
- **Verify**: No network requests to huggingface.co during model loading
- **Verify**: Model loads successfully with local files only
- **Verify**: Fallback to TF-IDF works if model files are missing
- **Verify**: Model is reused across multiple webview calls (singleton pattern)
