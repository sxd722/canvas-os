 import { useDebug } from '../../context/DebugContext';

interface DebugPanelProps {
  onClose: () => void;
}

export function DebugPanel({ onClose }: DebugPanelProps) {
  const { logs, clearLogs, isEnabled } = useDebug();

  if (!isEnabled) {
    return null;
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector(`[data-copy-btn]`);
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 2000);
      }
    });
  };

  return (
    <div className="fixed inset-0 right-0 bottom-0 z-50 bg-gray-900 border-l border-gray-700 flex flex-col" style={{ width: '500px' }}>
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200">Debug Panel</h2>
        <div className="flex gap-2">
          <button
            onClick={clearLogs}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            No API calls yet. Send a message to trigger an LLM call.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2 bg-gray-750">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${getStatusColor(log.status)}`}>
                    {log.type.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                <button
                  data-copy-btn
                  onClick={() => copyToClipboard(JSON.stringify(log, null, 2))}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                >
                  Copy
                </button>
              </div>

              <div className="p-3 space-y-2">
                <div>
                  <div className="text-xs font-medium text-gray-400 mb-1">Request:</div>
                      <pre className="text-xs text-blue-300 bg-gray-900 p-2 rounded overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                        {(() => {
                          if (typeof log.request === 'object' && log.request !== null) {
                            return JSON.stringify(log.request, null, 2);
                          }
                          return String(log.request);
                        })()}
                      </pre>
                </div>

                {log.status === 'pending' ? (
                  <div className="flex items-center gap-2 text-yellow-400 text-xs">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Waiting for response...
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1">Response:</div>
                    <pre className="text-xs text-green-300 bg-gray-900 p-2 rounded overflow-auto max-h-60 font-mono whitespace-pre-wrap">
                        {(() => {
                          if (typeof log.response === 'object' && log.response !== null) {
                            return JSON.stringify(log.response, null, 2);
                          }
                          return String(log.response);
                        })()}
                    </pre>
                  </div>
                )}

                {log.error && (
                  <div className="text-xs text-red-400 bg-red-900/50 p-2 rounded">
                    <span className="font-medium">Error:</span> {log.error}
                  </div>
                )}

                {log.duration !== undefined && (
                  <div className="text-xs text-gray-500">
                    Duration: {log.duration}ms
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
