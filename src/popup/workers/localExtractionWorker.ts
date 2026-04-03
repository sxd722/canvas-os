import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = true;
env.localModelPath = '/models/';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let generator: any = null;
let loading = false;

const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

async function getGenerator() {
  if (generator) return generator;
  if (loading) {
    return new Promise((resolve) => {
      const check = () => {
        if (generator) resolve(generator);
        else setTimeout(check, 200);
      };
      check();
    });
  }
  loading = true;
  try {
    console.log('[localExtractionWorker] Loading Qwen2.5-0.5B-Instruct on WebGPU...');
    generator = await pipeline('text-generation', MODEL_ID, {
      device: 'webgpu',
      dtype: 'q4f16',
      local_files_only: true,
    } as Record<string, unknown>);
    console.log('[localExtractionWorker] Model loaded successfully');
    return generator;
  } catch (err) {
    console.error('[localExtractionWorker] Failed to load model:', err);
    throw err;
  } finally {
    loading = false;
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { intent, elements } = event.data;

  try {
    const gen = await getGenerator();
    const messages = [
      {
        role: 'system',
        content:
          'You are an exact data extractor. Analyze the HTML snippets and extract the requested information. Return ONLY a concise JSON object or exact value. No explanations.',
      },
      {
        role: 'user',
        content: `Intent: ${intent}\nSnippets: ${JSON.stringify(elements)}`,
      },
    ];

    const output = await gen(messages, { max_new_tokens: 200, temperature: 0.1 });
    const text = (Array.isArray(output) ? output[0]?.generated_text : output?.generated_text) || '';

    self.postMessage({ status: 'success', text });
  } catch (err) {
    console.error('[localExtractionWorker] Generation error:', err);
    self.postMessage({ status: 'error', error: String(err) });
  }
};
