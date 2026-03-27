import { Readability } from '@mozilla/readability';
import type { ContentExtractionResult, ExtractionMode } from '../../shared/types';

const MAX_CONTENT_SIZE = 50000;
const DEFAULT_TIMEOUT = 30000;

export function extractTextContent(html: string, url: string): ContentExtractionResult {
  const startTime = Date.now();
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const bodyText = doc.body?.innerText || '';
    const title = doc.title || new URL(url).hostname;
    
    const content = truncateContent(bodyText);
    const metadata = extractMetadata(content, startTime);
    
    return {
      success: true,
      content,
      url,
      title,
      metadata,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : 'Content extraction failed',
      timestamp: Date.now()
    };
  }
}

export function truncateContent(content: string, maxSize: number = MAX_CONTENT_SIZE): string {
  if (content.length <= maxSize) {
    return content;
  }
  
  const truncated = content.slice(0, maxSize);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxSize * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

export function extractMetadata(content: string, startTime: number): { wordCount: number; charCount: number; extractionTime: number } {
  const words = content.trim().split(/\s+/).filter(Boolean);
  
  return {
    wordCount: words.length,
    charCount: content.length,
    extractionTime: Date.now() - startTime
  };
}

export function extractMainContent(html: string, url: string): ContentExtractionResult {
  const startTime = Date.now();
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const reader = new Readability(doc);
    const article = reader.parse();
    
    if (!article) {
      return extractTextContent(html, url);
    }
    
    const content = truncateContent(article.textContent || '');
    const metadata = {
      ...extractMetadata(content, startTime),
      readingTime: Math.ceil((content.split(/\s+/).length) / 200)
    };
    
    return {
      success: true,
      content,
      url,
      title: article.title || doc.title || new URL(url).hostname,
      metadata,
      timestamp: Date.now()
    };
} catch {
      return extractTextContent(html, url);
    }
}

export function extractPrices(content: string): string[] {
  const pricePatterns = [
    /\$[\d,]+(?:\.\d{2})?/g,
    /€[\d,]+(?:\.\d{2})?/g,
    /£[\d,]+(?:\.\d{2})?/g,
    /¥[\d,]+/g,
    /[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY)/gi
  ];
  
  const prices = new Set<string>();
  
  for (const pattern of pricePatterns) {
    const matches = content.match(pattern) || [];
    matches.forEach(p => prices.add(p));
  }
  
  return Array.from(prices);
}

export function extractEmails(content: string): string[] {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = content.match(emailPattern) || [];
  return [...new Set(matches)];
}

export function extractDates(content: string): string[] {
  const datePatterns = [
    /\d{4}-\d{2}-\d{2}/g,
    /\d{2}\/\d{2}\/\d{4}/g,
    /\d{2}\/\d{2}\/\d{2}/g,
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
    /\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/gi
  ];
  
  const dates = new Set<string>();
  
  for (const pattern of datePatterns) {
    const matches = content.match(pattern) || [];
    matches.forEach(d => dates.add(d));
  }
  
  return Array.from(dates);
}

export function extractDataPoints(content: string): { prices: string[]; emails: string[]; dates: string[] } {
  return {
    prices: extractPrices(content),
    emails: extractEmails(content),
    dates: extractDates(content)
  };
}

export async function fetchAndExtract(
  url: string, 
  mode: ExtractionMode = 'full',
  timeout: number = DEFAULT_TIMEOUT
): Promise<ContentExtractionResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,text/plain'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {
        success: false,
        url,
        error: `HTTP ${response.status}: ${response.statusText}`,
        timestamp: Date.now()
      };
    }
    
    const html = await response.text();
    
    switch (mode) {
      case 'readability':
        return extractMainContent(html, url);
      case 'data-points': {
        const baseResult = extractTextContent(html, url);
        if (!baseResult.success || !baseResult.content) {
          return baseResult;
        }
        const dataPoints = extractDataPoints(baseResult.content);
        return {
          ...baseResult,
          content: JSON.stringify(dataPoints, null, 2)
        };
      }
      case 'full':
      default:
        return extractTextContent(html, url);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        url,
        error: 'Request timeout',
        timestamp: Date.now()
      };
    }
    
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : 'Fetch failed',
      timestamp: Date.now()
    };
  }
}

export function getExtractionModeFromString(mode?: string): ExtractionMode {
  if (mode === 'readability' || mode === 'data-points') {
    return mode;
  }
  return 'full';
}
