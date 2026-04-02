import { PageExtraction } from '../../shared/types';
import { scoreElements } from './semanticExtractor';

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
        elements: [],
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
          // Score elements with embedding model (fallback to TF-IDF) if intent provided
          if (intent && payload.elements && payload.elements.length > 0) {
            const scored = await scoreElements(intent, payload.elements.map((el: { text: string; description: string }) => ({
              text: el.text || '',
              description: el.description || ''
            })));

            // Merge scores back into elements
            const mergedElements = payload.elements.map((el: { text: string; description: string; relevanceScore?: number }) => {
              const scoredEl = scored.find(s => s.text === el.text && s.description === el.description);
              return {
                ...el,
                relevanceScore: scoredEl?.relevanceScore ?? el.relevanceScore ?? 0
              };
            });

            resolve({
              ...payload,
              elements: mergedElements,
              extractionMethod: 'tfidf',
              success: true
            });
          } else {
            resolve({ ...payload, extractionMethod: payload.extractionMethod || 'tfidf', success: true });
          }
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
