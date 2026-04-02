# Tasks: Bundle Model for Local Inference

**Feature**: 014-bundle-model-inference
**Branch**: `014-bundle-model-inference`
**Date**: 2026-04-01
**Input**: Feature specification from `/specs/014-bundle-model-inference/spec.md`
**Status**: Ready for Implementation

---

## Summary

Bundle the Xenova/all-MiniLM-L6-v2 ONNX model (~80MB quantized) directly in the extension repository to enable offline semantic extraction for webview tool calls. Configure Transformers.js to load from local bundled files instead of remote Hugging Face Hub, and build validation pipelines to ensure model files are present before bundling.

**Implementation scope**: 3 files modified, 2 files created, ~100 lines changed
- `src/popup/services/semanticExtractor.ts` - Model loading configuration
- `vite.config.js` - Build validation
- `AGENTS.md` - Documentation
- `public/models/Xenova/all-MiniLM-L6-v2/` - Model files (downloaded)
- `scripts/download-model.js` - Model download helper (optional)

**Independent delivery**: Each user story can be implemented, tested, and deployed independently.
**MVP scope**: User Story 1 only (bundle model files)
**Estimated effort**: 2-4 hours

---

## Task Breakdown

| Phase | User Story | Task Count | Parallel | Purpose |
|-------|-----------|-------------|----------|---------|
| 1 | Setup | 3 | Yes | Project structure verification |
| 2 | Foundational | 1 | No | Download model files |
| 3 | US1 - Bundle Model for Offline Use | 2 | Yes | Model file integration |
| 4 | US2 - Semantic Inference Pipeline | 3 | Yes | Model loading configuration |
| 5 | US3 - Build Pipeline Validation | 2 | Yes | Build validation |
| 6 | Polish | 3 | Yes | Documentation, build, lint |

| **Total** | **14 tasks** |

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → **Phase 3 (US1)** → **Phase 4 (US2)** → **Phase 5 (US3)** → **Phase 6 (Polish)**
- All phases sequential
- Within phases, tasks marked [P] can run in parallel

- **User stories can be deployed independently in any order**
- **Foundational (Phase 2)** must be completed before US stories
- **All user stories should be tested before deployment**
- **MVP = User Story 1 only** (bundle model files)
- **All user stories can be tested independently**

---

## Phase 1: Setup

- [X] T001 Verify git repo is initialized
- [X] T002 Verify .gitignore has necessary patterns
- [X] T003 Create model directory structure at public/models/Xenova/all-MiniLM-L6-v2/

---

## Phase 2: Foundational

- [X] T004 Download Xenova/all-MiniLM-L6-v2 model files from Hugging Face Hub

**Download instructions**:
```bash
# Create directory
mkdir -p public/models/Xenova/all-MiniLM-L6-v2/onnx

# Download quantized ONNX model (~22MB)
curl -L -o public/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx \
  https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx

# Download tokenizer config
curl -L -o public/models/Xenova/all-MiniLM-L6-v2/tokenizer.json \
  https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json

# Download model config
curl -L -o public/models/Xenova/all-MiniLM-L6-v2/config.json \
  https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json

# Verify download
ls -la public/models/Xenova/all-MiniLM-L6-v2/onnx/
ls -la public/models/Xenova/all-MiniLM-L6-v2/
```

---

## Phase 3: US1 - Bundle Model for Offline Use (Priority: P1)

**Goal**: Download and commit model files to repository so they are bundled with the extension.

**Independent Test**: Can be fully tested by building the extension and verifying that model files appear in `dist/models/` directory without any network requests.

- [X] T005 [US1] Verify model files downloaded correctly in public/models/Xenova/all-MiniLM-L6-v2/
- [X] T006 [US1] Add model files to git tracking (note: large files ~22MB)

**Checkpoint**: At this point, User Story 1 should be fully functional - model files are bundled with extension.

---

## Phase 4: US2 - Semantic Inference Pipeline (Priority: P1)

**Goal**: Configure Transformers.js to load the bundled model from local files instead of downloading from Hugging Face Hub.

**Independent Test**: Can be fully tested by loading the extension offline and triggering a webview tool call - model should load successfully without network requests.

- [X] T007 [US2] Update semanticExtractor.ts to use local_files_only option in src/popup/services/semanticExtractor.ts
- [X] T008 [US2] Add progress_callback for model loading status in src/popup/services/semanticExtractor.ts
- [X] T009 [US2] Test model loading from local files (verify no network requests in DevTools)

**Implementation reference** (from contracts/model-config-contract.md):
```typescript
// In src/popup/services/semanticExtractor.ts
embeddingPipeline = await pipeline('feature-extraction', MODEL_ID, {
  quantized: true,
  local_files_only: true,  // NEW: Load from local files
  progress_callback: (progress) => {
    if (progress.status === 'progress') {
      const percent = (progress.loaded * 100) / progress.total;
      console.log(`[semanticExtractor] Model loading: ${percent.toFixed(1)}% complete`);
    }
  }
} as Record<string, unknown>);
```

**Checkpoint**: At this point, User Story 2 should be fully functional - model loads from local files with offline capability.

---

## Phase 5: US3 - Build Pipeline Validation (Priority: P2)

**Goal**: Add build-time validation to ensure model files are present before bundling, catching errors early.

**Independent Test**: Can be fully tested by removing model files and running `npm run build` - build should fail with clear error message.

- [X] T010 [US3] Add build validation in vite.config.js to check model file existence
- [X] T011 [US3] Test build fails with clear error when model files are missing

**Implementation approach** (from research.md):
```javascript
// vite.config.js - add model file validation
import { existsSync } from 'fs';
import { resolve } from 'path';

const MODEL_DIR = 'public/models/Xenova/all-MiniLM-L6-v2';
const REQUIRED_FILES = [
  'onnx/model_quantized.onnx',
  'tokenizer.json',
  'config.json'
];

// Validate model files exist before build
function validateModelFiles() {
  const missingFiles = [];
  for (const file of REQUIRED_FILES) {
    const filePath = resolve(__dirname, 'public/models/Xenova/all-MiniLM-L6-v2', file);
    if (!existsSync(filePath)) {
      missingFiles.push(file);
      }
      
      if (missingFiles.length > 0) {
        console.error('\n❌ Build failed: Missing model files:');
        missingFiles.forEach(f => console.error(`   - ${f}`));
        console.error('\nRun the download instructions in specs/014-bundle-model-inference/tasks.md Phase 2\n');
        process.exit(1);
      }
      
      console.log('✓ Model files validated');
}

// Call validation before build
validateModelFiles();
```

**Checkpoint**: At this point, User Story 3 should be fully functional - build validates model file presence.

---

## Phase 6: Polish

- [X] T012 [P] Update AGENTS.md with model bundling feature notes
- [X] T013 [P] Run build verification (npm run build)
- [X] T014 [P] Run lint verification (npm run lint)

---

## Parallel Execution Examples

### Setup Phase (Parallel)
```bash
# T001, T002, T003 can run in parallel
git rev-parse --git-dir 2>/dev/null
cat .gitignore
mkdir -p public/models/Xenova/all-MiniLM-L6-v2
```

### US1 Phase (Sequential)
```bash
# T005: Verify files exist
ls -la public/models/Xenova/all-MiniLM-L6-v2/

# T006: Add to git
git add public/models/Xenova/all-MiniLM-L6-v2/
```

### US2 Phase (Parallel)
```bash
# T007, T008 can run in parallel (same file, different changes)
# Both modify src/popup/services/semanticExtractor.ts
```

### US3 Phase (Sequential)
```bash
# T010: Add validation to vite.config.js
# T011: Test by removing model files and running build
```

### Polish Phase (Parallel)
```bash
# T012, T013, T014 can run in parallel
# Different files, no dependencies
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (download model files)
3. Complete Phase 3: US1 (bundle model files)
4. **STOP and VALIDATE**: Verify model files in dist/models/
5. Deploy/demo if ready (extension now has model files bundled)

### Incremental Delivery
1. Complete Setup + Foundational → Model files downloaded
2. Add US1 → Test independently → Deploy/Demo (MVP - model files bundled)
3. Add US2 → Test independently → Deploy/Demo (model loads from local files)
4. Add US3 → Test independently → Deploy/Demo (build validation added)
5. Each story adds value without breaking previous stories

---

## Notes

- **Model size**: ~22MB quantized ONNX model adds significant size to extension bundle size
- **Chrome Web Store**: Size limits (50MB initial, 100MB updates) may require alternative distribution
- **Offline capability**: After US1+US2, extension works completely offline
- **Performance**: Model loads once per session and is reused for all webview calls (singleton pattern)
- **Fallback**: TF-IDF scoring remains as fallback if model loading fails
- **Git LFS**: Consider using Git LFS for large model files if repository size becomes an issue
