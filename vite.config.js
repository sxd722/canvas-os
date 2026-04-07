import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Model file validation
const MODEL_DIR = 'public/models/Xenova/all-MiniLM-L6-v2';
const REQUIRED_FILES = [
  'onnx/model_quantized.onnx',
  'tokenizer.json',
  'config.json'
];

function validateModelFiles() {
  console.log('\n🔍 Validating model files...');
  
  const missingFiles = [];
  const modelPath = resolve(__dirname, MODEL_DIR);
  
  for (const file of REQUIRED_FILES) {
    const filePath = resolve(modelPath, file);
    if (!existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    console.error('\n❌ Build failed: Missing model files:');
    missingFiles.forEach(f => console.error(`   - ${MODEL_DIR}/${f}`));
    console.error('\n📥 Download instructions:');
    console.error('   Run the download commands from specs/014-bundle-model-inference/tasks.md Phase 2\n');
    console.error('   Or download manually from: https://huggingface.co/Xenova/all-MiniLM-L6-v2\n');
    process.exit(1);
  }
  
  console.log('✅ All model files validated\n');
}

// Run validation before build
validateModelFiles();

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
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
    }
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers']
  },
  worker: {
    format: 'es'
  },

});

