import { useState, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { PopupToIframeMessage, PageExtraction } from '../../shared/types';

export type WebViewStatus = 'loading' | 'loaded' | 'blocked' | 'error' | 'interacting';

export interface EmbeddedWebViewHandle {
  sendMessageToIframe: (message: PopupToIframeMessage) => void;
}

export interface EmbeddedWebViewProps {
  url: string;
  title?: string;
  nodeId: string;
  sessionId?: string;
  channelNonce?: string;
  onStatusChange?: (status: WebViewStatus) => void;
  onExtraction?: (extraction: PageExtraction) => void;
  onInteractionResult?: (result: { success: boolean; newUrl?: string; navigated: boolean }) => void;
}

const EmbeddedWebView = forwardRef<EmbeddedWebViewHandle, EmbeddedWebViewProps>(function EmbeddedWebView({
  url,
  title,
  nodeId,
  sessionId,
  channelNonce,
  onStatusChange,
  onExtraction,
  onInteractionResult}: EmbeddedWebViewProps, ref) {
  const [status, setStatus] = useState<WebViewStatus>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [scale, setScale] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setScale(entries[0].contentRect.width / 1280);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const updateStatus = useCallback((newStatus: WebViewStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  // Send message to iframe content script via postMessage
  const sendMessageToIframe = useCallback((message: PopupToIframeMessage) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      ...message,
      nonce: channelNonce
    }, '*');
  }, [channelNonce]);

  // Expose sendMessageToIframe via ref handle
  useImperativeHandle(ref, () => ({ sendMessageToIframe }), [sendMessageToIframe]);

  // Listen for messages from iframe content script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;

      // Validate nonce to prevent cross-origin interference
      if (channelNonce && data?.nonce !== channelNonce) return;

      if (data?.type === 'X_FRAME_OPTIONS_BLOCKED' && data?.url === url) {
        updateStatus('blocked');
        return;
      }

      // Handle webview bridge responses (both direct and via source field)
      const isBridgeMessage = data?.source === 'webview-bridge'
        || data?.type === 'CONTENT_RESPONSE'
        || data?.type === 'INTERACTION_RESULT'
        || data?.type === 'NAVIGATION_COMPLETE'
        || data?.type === 'EXTRACT_RESULT';

      if (isBridgeMessage) {
        switch (data.type) {
          case 'CONTENT_RESPONSE': {
            if (data.extraction && onExtraction) {
              onExtraction(data.extraction as PageExtraction);
            }
            updateStatus('loaded');
            break;
          }
          case 'EXTRACTION_RESULT': {
            if (data.payload && onExtraction) {
              onExtraction(data.payload as PageExtraction);
            }
            updateStatus('loaded');
            break;
          }
          case 'INTERACTION_RESULT': {
            if (data.payload && onInteractionResult) {
              onInteractionResult(data.payload as { success: boolean; newUrl?: string; navigated: boolean });
            }
            updateStatus('loaded');
            break;
          }
          case 'NAVIGATION_COMPLETE': {
            updateStatus('loaded');
            break;
          }
          case 'PAGE_STATUS': {
            if (data.payload?.status === 'ready') {
              updateStatus('loaded');
            } else if (data.payload?.status === 'loading') {
              updateStatus('loading');
            }
            break;
          }
          case 'ERROR': {
            console.error('Webview bridge error:', data.payload?.message);
            updateStatus('error');
            break;
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [url, channelNonce, updateStatus, onExtraction, onInteractionResult]);

  const handleLoad = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    updateStatus('loaded');
  }, [updateStatus]);

  const handleError = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    updateStatus('error');
  }, [updateStatus]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setStatus('loading');
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  }, [url]);

  useEffect(() => {
    loadTimeoutRef.current = setTimeout(() => {
      if (status === 'loading') {
        updateStatus('blocked');
      }
    }, 15000);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [url, retryCount, status, updateStatus]);

  return (
    <div className="h-full flex flex-col" data-node-id={nodeId} data-session-id={sessionId}>
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-xs text-blue-400 truncate max-w-[70%]" title={url}>
          {title || new URL(url).hostname}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
          status === 'loading' ? 'bg-yellow-900 text-yellow-300' :
          status === 'loaded' ? 'bg-green-900 text-green-300' :
          status === 'interacting' ? 'bg-blue-900 text-blue-300' :
          status === 'blocked' ? 'bg-orange-900 text-orange-300' :
          'bg-red-900 text-red-300'
        }`}>
          {status}
        </span>
      </div>

      <div className="flex-1 relative min-h-0 bg-gray-900 rounded overflow-y-auto overflow-x-hidden" ref={containerRef}>
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 text-blue-400 mx-auto mb-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          </div>
        )}

        {status === 'blocked' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 p-4">
            <div className="text-center">
              <svg className="h-8 w-8 text-orange-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9-9a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-orange-400 mb-2">
                This site cannot be embedded due to security restrictions.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in new tab
              </a>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 p-4">
            <div className="text-center">
              <svg className="h-8 w-8 text-red-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-red-400 mb-2">Failed to load page.</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleRetry}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Retry
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in new tab
                </a>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: `${4000 * scale}px`, width: '100%' }}>
          <iframe
            ref={iframeRef}
            key={retryCount}
            src={url}
            onLoad={handleLoad}
            onError={handleError}
            style={{ width: '1280px', height: '4000px', transform: `scale(${scale})`, transformOrigin: 'top left', border: 'none' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={title || url}
          />
        </div>
      </div>
    </div>
  );
});

export default EmbeddedWebView;
