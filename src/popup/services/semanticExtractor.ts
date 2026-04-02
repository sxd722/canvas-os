/**
 * Semantic extraction engine with embedding-based scoring.
 *
 * Uses Transformers.js (Xenova/all-MiniLM-L6-v2) to encode browsing intents
 * and element descriptions into vector embeddings. Computes cosine similarity
 * to rank and filter the most semantically relevant interactive elements,
 * significantly reducing context window token usage compared to TF-IDF.
 *
 * Falls back to TF-IDF if the embedding model fails to load.
 */

import { pipeline } from '@xenova/transformers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingPipeline: any = null;
let modelLoading = false;
let modelLoadFailed = false;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

async function getEmbeddingPipeline(): Promise<Awaited<ReturnType<typeof pipeline>> | null> {
  if (embeddingPipeline) return embeddingPipeline;
  if (modelLoadFailed) return null;

  if (modelLoading) {
    // Wait for existing load to complete
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
    console.log(`[semanticExtractor] Loading embedding model from local files: ${MODEL_ID}...`);
    embeddingPipeline = await pipeline('feature-extraction', MODEL_ID, {
        quantized: true,
        local_files_only: true,
      } as Record<string, unknown>);
    console.log('[semanticExtractor] Embedding model loaded successfully from local files');
    return embeddingPipeline;
  } catch (err) {
    console.warn('[semanticExtractor] Failed to load embedding model from local files, falling back to TF-IDF:', err);
    modelLoadFailed = true;
    return null;
  } finally {
    modelLoading = false;
  }
}

// --- Cosine similarity for float arrays ---

export function cosineSimilarityVectors(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

// --- Embedding-based scoring ---

async function scoreElementsEmbedding(
  intent: string,
  elements: Array<{ text: string; description: string }>,
  topN: number = 15
): Promise<Array<{ text: string; description: string; relevanceScore: number }> | null> {
  const pipe = await getEmbeddingPipeline();
  if (!pipe) return null;

  // Encode intent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intentOutput: any = await pipe(intent, { pooling: 'mean', normalize: true } as any);
  const intentEmbedding: number[] = Array.from(intentOutput.data || []);
  if (!intentEmbedding || intentEmbedding.length === 0) return null;

  // Encode each element description
  const elementTexts = elements.map(el =>
    `${el.text} ${el.description}`.substring(0, 200)
  );

  // Batch encode elements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsOutput: any = await pipe(elementTexts as any, { pooling: 'mean', normalize: true } as any);
  const elementEmbeddings: number[][] = elementsOutput.data
    ? Array.from(elementsOutput.data)
    : [];

  if (elementEmbeddings.length !== elements.length) return null;

  // Score by cosine similarity
  return elements
    .map((el, index) => {
      const embedding = elementEmbeddings[index];
      if (!embedding) return { text: el.text, description: el.description, relevanceScore: 0 };
      return {
        text: el.text,
        description: el.description,
        relevanceScore: cosineSimilarityVectors(intentEmbedding, Array.from(embedding))
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topN);
}

// --- TF-IDF Fallback (pure JS, zero dependencies) ---

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'to',
  'for', 'with', 'on', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'and', 'but', 'or', 'if', 'it',
  'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they',
  'them', 'their', 'what', 'which', 'who'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function computeTermFreq(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

function computeIdf(corpus: string[][]): Map<string, number> {
  const docCount = corpus.length;
  const df = new Map<string, number>();
  for (const doc of corpus) {
    const unique = new Set(doc);
    for (const term of unique) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((docCount + 1) / (freq + 1)) + 1);
  }
  return idf;
}

function computeTfIdf(docTokens: string[], corpusTokens: string[][]): Map<string, number> {
  const tf = computeTermFreq(docTokens);
  const idf = computeIdf(corpusTokens);
  const tfidf = new Map<string, number>();
  for (const [term, freq] of tf) {
    const idfVal = idf.get(term) || 0;
    tfidf.set(term, freq * idfVal);
  }
  return tfidf;
}

export function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  const allKeys = new Set([...vecA.keys(), ...vecB.keys()]);
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (const key of allKeys) {
    const a = vecA.get(key) || 0;
    const b = vecB.get(key) || 0;
    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

function scoreElementsTfIdf(
  intent: string,
  elements: Array<{ text: string; description: string }>,
  topN: number = 15
): Array<{ text: string; description: string; relevanceScore: number }> {
  if (elements.length === 0) return [];

  const intentTokens = tokenize(intent);
  if (intentTokens.length === 0) {
    return elements.map(el => ({ text: el.text, description: el.description, relevanceScore: 0 }));
  }

  const elementTokenArrays = elements.map(el => tokenize(`${el.text} ${el.description}`));
  const corpus = [intentTokens, ...elementTokenArrays];
  const intentTfIdf = computeTfIdf(intentTokens, corpus);

  const scored = elements.map((el, index) => {
    const elTfIdf = computeTfIdf(elementTokenArrays[index], corpus);
    const score = cosineSimilarity(intentTfIdf, elTfIdf);
    return { text: el.text, description: el.description, relevanceScore: score };
  });

  return scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topN);
}

// --- Public API ---

export interface ScoreableItem {
  text: string;
  description: string;
  relevanceScore: number;
}

/**
 * Score elements against an intent using embedding model (preferred)
 * with automatic fallback to TF-IDF if the model is unavailable.
 */
export async function scoreElements(
  intent: string,
  elements: Array<{ text: string; description: string }>,
  topN: number = 15
): Promise<ScoreableItem[]> {
  if (elements.length === 0) return [];

  // Try embedding-based scoring first
  const embeddingResult = await scoreElementsEmbedding(intent, elements, topN);
  if (embeddingResult) return embeddingResult;

  // Fall back to TF-IDF
  return scoreElementsTfIdf(intent, elements, topN);
}

// --- Heuristic fallback: build page summary from structured data ---

export function extractPageSummaryHeuristic(data: {
  title?: string;
  metaDescription?: string;
  headings?: string[];
}): string {
  const parts: string[] = [];
  if (data.title) parts.push(data.title);
  if (data.metaDescription) parts.push(data.metaDescription);
  if (data.headings && data.headings.length > 0) {
    parts.push(data.headings.slice(0, 5).join(' | '));
  }
  return parts.join('. ');
}

// --- Extraction quality metrics ---

export interface PageExtractionMetrics {
  payloadTokenEstimate: number;
  reductionRatio: number;
  elementCount: number;
  highRelevanceCount: number;
  hasSummary: boolean;
}

export function computePayloadSize(extraction: {
  summary?: string;
  elements?: Array<{ text: string; description: string; relevanceScore?: number }>;
}): number {
  let charCount = 0;
  if (extraction.summary) charCount += extraction.summary.length;
  if (extraction.elements) {
    for (const el of extraction.elements) {
      charCount += (el.text?.length || 0) + (el.description?.length || 0);
    }
  }
  return Math.ceil(charCount / 4);
}

export function computeReductionRatio(
  extraction: { summary?: string; elements?: Array<{ text: string; description: string; relevanceScore?: number }> },
  rawHtmlLength: number
): number {
  if (rawHtmlLength === 0) return 0;
  const payloadChars = computePayloadSize(extraction) * 4;
  return Math.max(0, 1 - payloadChars / rawHtmlLength);
}

export function getExtractionMetrics(
  extraction: {
    summary?: string;
    elements?: Array<{ text: string; description: string; relevanceScore?: number }>;
  },
  rawHtmlLength?: number
): PageExtractionMetrics {
  const elements = extraction.elements || [];
  const highRelevance = elements.filter(el => (el.relevanceScore || 0) > 0.2);

  return {
    payloadTokenEstimate: computePayloadSize(extraction),
    reductionRatio: rawHtmlLength ? computeReductionRatio(extraction, rawHtmlLength) : 0,
    elementCount: elements.length,
    highRelevanceCount: highRelevance.length,
    hasSummary: !!(extraction.summary && extraction.summary.length > 0)
  };
}
