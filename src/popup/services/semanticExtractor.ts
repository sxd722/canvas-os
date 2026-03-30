/**
 * TF-IDF scoring engine for element relevance scoring.
 * Pure JS, zero external dependencies. Ranks interactive elements
 * from webview page content against the LLM's browsing intent.
 */

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

// --- Tokenizer ---

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

// --- Term Frequency ---

function computeTermFreq(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

// --- Inverse Document Frequency ---

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

// --- TF-IDF Vector for a single document ---

export function computeTfIdf(
  docTokens: string[],
  corpusTokens: string[][]
): Map<string, number> {
  const tf = computeTermFreq(docTokens);
  const idf = computeIdf(corpusTokens);

  const tfidf = new Map<string, number>();
  for (const [term, freq] of tf) {
    const idfVal = idf.get(term) || 0;
    tfidf.set(term, freq * idfVal);
  }
  return tfidf;
}

// --- Cosine similarity between two TF-IDF vectors ---

export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
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

// --- Score elements against an intent ---

export interface ScoreableItem {
  text: string;
  description: string;
  relevanceScore: number;
}

export function scoreElements(
  intent: string,
  elements: Array<{ text: string; description: string }>,
  topN: number = 15
): ScoreableItem[] {
  if (elements.length === 0) return [];

  const intentTokens = tokenize(intent);
  if (intentTokens.length === 0) {
    return elements.map(el => ({
      text: el.text,
      description: el.description,
      relevanceScore: 0
    }));
  }

  // Build corpus: intent + all element texts
  const elementTokenArrays = elements.map(el =>
    tokenize(`${el.text} ${el.description}`)
  );
  const corpus = [intentTokens, ...elementTokenArrays];

  // Compute TF-IDF for intent
  const intentTfIdf = computeTfIdf(intentTokens, corpus);

  // Score each element by cosine similarity
  const scored: ScoreableItem[] = elements.map((el, index) => {
    const elTfIdf = computeTfIdf(elementTokenArrays[index], corpus);
    const score = cosineSimilarity(intentTfIdf, elTfIdf);

    return {
      text: el.text,
      description: el.description,
      relevanceScore: score
    };
  });

  // Sort by score descending, return top N
  return scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topN);
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

// --- Extraction quality metrics (T021) ---

export interface PageExtractionMetrics {
  payloadTokenEstimate: number;
  reductionRatio: number;
  elementCount: number;
  highRelevanceCount: number;
  hasSummary: boolean;
}

/**
 * Estimate token count from extraction payload.
 * Rough heuristic: 1 token ≈ 4 characters for English text.
 */
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

/**
 * Compute reduction ratio vs raw HTML.
 * Returns a value between 0 and 1, where 0.9 means 90% reduction.
 */
export function computeReductionRatio(
  extraction: { summary?: string; elements?: Array<{ text: string; description: string; relevanceScore?: number }> },
  rawHtmlLength: number
): number {
  if (rawHtmlLength === 0) return 0;
  const payloadChars = computePayloadSize(extraction) * 4;
  return Math.max(0, 1 - payloadChars / rawHtmlLength);
}

/**
 * Get full extraction quality metrics.
 */
export function getExtractionMetrics(
  extraction: {
    summary?: string;
    elements?: Array<{ text: string; description: string; relevanceScore?: number }>;
  },
  rawHtmlLength?: number
): PageExtractionMetrics {
  const elements = extraction.elements || [];
  const highRelevance = elements.filter(el => (el.relevanceScore || 0) > 0.2);

  // If TF-IDF yields < 3 elements with relevanceScore > 0.2, generate a fallback summary
  if (highRelevance.length < 3 && extraction.summary) {
    // The summary from webview_bridge serves as the fallback
  }

  return {
    payloadTokenEstimate: computePayloadSize(extraction),
    reductionRatio: rawHtmlLength ? computeReductionRatio(extraction, rawHtmlLength) : 0,
    elementCount: elements.length,
    highRelevanceCount: highRelevance.length,
    hasSummary: !!(extraction.summary && extraction.summary.length > 0)
  };
}
