/**
 * Unit tests for webpage content extraction logic.
 * Tests the text processing and readability extraction that the background
 * script uses in handleContentFetch — independent of Chrome APIs.
 */

/// <reference types="vitest" />

// Replicate the readability extraction logic from background/index.ts handleContentFetch
function extractReadabilityContent(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

describe('content extraction - readability mode', () => {
  it('strips script tags and their content', () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = extractReadabilityContent(html);
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('strips style tags and their content', () => {
    const html = '<p>Hello</p><style>body { color: red; }</style><p>World</p>';
    const result = extractReadabilityContent(html);
    expect(result).not.toContain('color: red');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('removes HTML tags but preserves text content', () => {
    const html = '<h1>标题</h1><p>这是<strong>重要</strong>的<span>内容</span></p>';
    const result = extractReadabilityContent(html);
    expect(result).not.toContain('<');
    expect(result).toContain('标题');
    expect(result).toContain('这是');
    // Tags are replaced with spaces, so '重要' and '的' are separated
    expect(result).toContain('重要');
    expect(result).toContain('内容');
  });

  it('collapses multiple whitespace into single spaces', () => {
    const html = '<div>  Hello   World  </div>';
    const result = extractReadabilityContent(html);
    expect(result).toBe('Hello World');
  });

  it('handles Chinese text correctly', () => {
    const html = '<h1>百度一下，你就知道</h1><p>全球最大的中文搜索引擎</p>';
    const result = extractReadabilityContent(html);
    expect(result).toContain('百度一下');
    expect(result).toContain('你就知道');
    expect(result).toContain('全球最大的中文搜索引擎');
  });
});

describe('content extraction - word counting', () => {
  it('counts English words correctly', () => {
    expect(countWords('Hello World')).toBe(2);
    expect(countWords('The quick brown fox')).toBe(4);
  });

  it('counts Chinese characters as words', () => {
    // Chinese text has no spaces between words — each segment between whitespace is a "word"
    expect(countWords('百度一下')).toBe(1);
    expect(countWords('全球最大的中文搜索引擎')).toBe(1);
    expect(countWords('百度一下 你就知道')).toBe(2);
  });

  it('handles mixed content', () => {
    expect(countWords('Hello 世界 World')).toBe(3);
  });
});
