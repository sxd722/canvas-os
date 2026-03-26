export function extractPageContent(): string {
  const body = document.body;
  if (!body) return '';
  
  const content = body.innerText || body.textContent || '';
  return content.trim();
}

if (typeof window !== 'undefined') {
  (window as unknown as { canvasOSScraper: { extract: typeof extractPageContent } }).canvasOSScraper = {
    extract: extractPageContent
  };
}
