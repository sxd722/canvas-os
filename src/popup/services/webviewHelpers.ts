import { PageExtraction } from '../../shared/types';
import { scoreElements, extractWithLLM } from './semanticExtractor';

// --- Webview postMessage Helpers ---

/**
 * Find the iframe element for a given session and postMessage to its contentWindow.
 * This avoids broadcasting to all iframes via window.postMessage.
 */
export function postToIframe(sessionId: string, message: Record<string, unknown>, canvasNodeId?: string): void {
  let container: Element | null = null;
  let lookupMethod = 'none';

  if (canvasNodeId) {
    container = document.querySelector(`[data-node-id="${canvasNodeId}"]`);
    lookupMethod = 'nodeId';
  }

  if (!container) {
    container = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (container) {
      lookupMethod = 'sessionId';
    }
  }

  if (!container) {
    const allContainers = document.querySelectorAll('[data-node-id], [data-session-id]');
    console.warn(`[toolRegistry] No container found for session ${sessionId}${canvasNodeId ? ` or nodeId ${canvasNodeId}` : ''}. Available containers:`, Array.from(allContainers).map(el => `nodeId=${el.getAttribute('data-node-id')}, sessionId=${el.getAttribute('data-session-id')}`).join(' | '));
    return;
  }

  const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
  if (!iframe?.contentWindow) {
    console.warn(`[toolRegistry] Iframe or contentWindow not available | sessionId=${sessionId} | nodeId=${canvasNodeId || '(none)'} | lookup=${lookupMethod}`);
    return;
  }
  console.log(`[toolRegistry] postToIframe | sessionId=${sessionId} | nodeId=${canvasNodeId || '(none)'} | lookup=${lookupMethod}`);
  iframe.contentWindow.postMessage(message, '*');
}

/**
 * Send EXTRACT_CONTENT to iframe by URL and wait for CONTENT_RESPONSE.
 * Finds the iframe by src URL, retries every 100ms for up to 2s if not found,
 * then sends postMessage directly to the matched iframe.
 */
export function waitForExtraction(nonce: string, sessionId: string, intent: string, timeoutMs: number, url: string, canvasNodeId?: string): Promise<PageExtraction> {
  return new Promise((resolve) => {
    let settled = false;

    const failResult = (error: string) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', handler);
      resolve({
        url,
        title: '',
        summary: '',
        interactive_elements: [],
        information_chunks: [],
        extractionMethod: 'tfidf',
        extractedAt: Date.now(),
        totalElementsFound: 0,
        success: false,
        error
      });
    };

    const timeoutId = setTimeout(() => {
      if (settled) return;
      clearInterval(pingInterval);
      failResult('Extraction timed out');
    }, timeoutMs);

    const handler = async (event: MessageEvent) => {
      const data = event.data;
      if (data?.nonce !== nonce) return;

      if (data?.type === 'CONTENT_RESPONSE' || (data?.source === 'webview-bridge' && data?.type === 'EXTRACTION_RESULT')) {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        clearInterval(pingInterval);
        window.removeEventListener('message', handler);

        // Handle both message formats (direct content script and bridge)
        const payload = data.extraction || data.payload;
        if (payload) {
          const interactiveElements = payload.interactive_elements || payload.elements || [];
          const informationChunks = payload.information_chunks || [];

          if (intent) {
            const itemsToScore: Array<{ text: string; description: string; element: any; }> = [];
            const chunksToScore: Array<{ text: string; description: string; element: any; }> = [];

            for (const el of interactiveElements) {
              itemsToScore.push({ text: el.text || '', description: el.description || '', element: el });
            }
            for (const chunk of informationChunks) {
              const chunkText = (chunk as { text?: string }).text || '';
              const chunkDesc = (chunk as { description?: string; context?: string[] }).description
                || ((chunk as { context?: string[] }).context || []).join(' > ')
                || '';
              if (chunkText.length > 3) {
                chunksToScore.push({ text: chunkText, description: chunkDesc, element: chunk });
              }
            }

            let scoredElements = undefined;
            if (itemsToScore.length > 0) {
              const scored = await scoreElements(intent, itemsToScore);

              console.log(scored);

              scoredElements = scored.map((el: { text: string; description: string; relevanceScore?: number; element: any }) => {
                return {element: el.element, relevanceScore: el.relevanceScore};
              }).filter(c => (c.relevanceScore as number) > 0);
            }

            let scoredChunks = undefined;
            if (chunksToScore.length > 0) {
              const scored = await scoreElements(intent, chunksToScore);
              scoredChunks = scored.map((chunk) => {
                return {element: chunk.element, relevanceScore: chunk.relevanceScore};
              }).filter(c => (c.relevanceScore as number) > 0);
            }

            const llmElementsResult = await extractWithLLM(intent, scoredElements ? (scoredElements.length > 0 ? scoredElements : interactiveElements.slice(0, 5)) : interactiveElements.slice(0, 5));
            const llmChunksResult = await extractWithLLM(intent, scoredChunks ? (scoredChunks.length > 0 ? scoredChunks : informationChunks.slice(0, 5)) : informationChunks.slice(0, 5));

            resolve({
              ...payload,
              interactive_elements: llmElementsResult.elements,
              information_chunks: llmChunksResult.elements,
              llm_extraction: llmElementsResult.llm_extraction || llmChunksResult.llm_extraction || '',
              extractionMethod: 'tfidf',
              success: true
            });
            return;
          }

          resolve({
            ...payload,
            interactive_elements: interactiveElements,
            information_chunks: informationChunks,
            extractionMethod: payload.extractionMethod || 'tfidf',
            success: true
          });
        } else {
          failResult('No extraction payload received');
        }
      }
    };

    window.addEventListener('message', handler);

    const pingInterval = setInterval(() => {
      if (settled) { clearInterval(pingInterval); return; }
      const containerId = canvasNodeId || sessionId;
      const container = document.querySelector(`[data-node-id="${containerId}"]`);
      const iframe = container?.querySelector('iframe') as HTMLIFrameElement | null;
      if (iframe?.contentWindow) {
        console.log(`[ToolRegistry] waitForExtraction | ping sent | containerId=${containerId}`);
        iframe.contentWindow.postMessage({ type: 'EXTRACT_CONTENT', nonce, intent, sessionId }, '*');
      }
    }, 500);
  });
}

/**
 * Send INTERACT_ELEMENT to iframe and wait for INTERACTION_RESULT.
 */
export function sendInteractionToIframe(
  sessionId: string,
  nonce: string,
  selector: string,
  action: 'click' | 'fill' | 'select',
  value?: string,
  canvasNodeId?: string
): Promise<{ success: boolean; newUrl?: string; navigated?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ success: false, error: 'Interaction timed out' });
    }, 10000);

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.nonce !== nonce) return;

      if (data?.type === 'INTERACTION_RESULT' || (data?.source === 'webview-bridge' && data?.type === 'INTERACTION_RESULT')) {
        clearTimeout(timeoutId);
        window.removeEventListener('message', handler);
        const payload = data.payload || data;
        resolve({
          success: payload.success ?? false,
          newUrl: payload.newUrl,
          navigated: payload.navigated ?? false,
          error: payload.error
        });
      }
    };

    window.addEventListener('message', handler);

    // Send INTERACT_ELEMENT command to the specific iframe by node-id (primary) or session-id (fallback)
    postToIframe(sessionId, {
      type: 'INTERACT_ELEMENT',
      nonce,
      selector,
      action,
      value
    }, canvasNodeId);
  });
}

/**
 * Wait for NAVIGATION_COMPLETE after sending NAVIGATE_BACK.
 */
export function waitForNavigationBack(nonce: string, timeoutMs: number): Promise<{ success: boolean; url?: string; title?: string; error?: string }> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ success: false, error: 'Navigation back timed out' });
    }, timeoutMs);

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.nonce !== nonce) return;

      if (data?.type === 'NAVIGATION_COMPLETE' || (data?.source === 'webview-bridge' && data?.type === 'NAVIGATION_COMPLETE')) {
        clearTimeout(timeoutId);
        window.removeEventListener('message', handler);
        const payload = data.payload || data;
        resolve({
          success: true,
          url: payload.url,
          title: payload.title
        });
      }
    };

    window.addEventListener('message', handler);
  });
}

/**
 * Send EXTRACT_BY_SELECTOR to iframe and wait for EXTRACT_RESULT.
 */
export function sendExtractBySelector(sessionId: string, nonce: string, selector: string, canvasNodeId?: string): Promise<{ success: boolean; data?: string; matchCount?: number; error?: string }> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ success: false, error: 'Selector extraction timed out' });
    }, 10000);

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.nonce !== nonce) return;

      if (data?.type === 'EXTRACT_RESULT' || (data?.source === 'webview-bridge' && data?.type === 'EXTRACT_RESULT')) {
        clearTimeout(timeoutId);
        window.removeEventListener('message', handler);
        const payload = data.payload || data;
        resolve({
          success: payload.success ?? true,
          data: payload.data || '',
          matchCount: payload.matchCount || (payload.data ? payload.data.split('\n').length : 0),
          error: payload.error
        });
      }
    };

    window.addEventListener('message', handler);

    // Send EXTRACT_BY_SELECTOR command to the specific iframe by node-id (primary) or session-id (fallback)
    postToIframe(sessionId, {
      type: 'EXTRACT_BY_SELECTOR',
      nonce,
      selector
    }, canvasNodeId);
  });
}
