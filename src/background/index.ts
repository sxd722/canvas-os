import { addCanvasNode, getCanvasNodes } from '../shared/storage';
import { generateId } from '../shared/types';

const RESEARCH_TIMEOUT = 30000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RESEARCH_URL') {
    handleResearchUrl(message.url, message.taskId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.type === 'DAG_FETCH') {
    handleDagFetch(message.url, message.method, message.headers, message.body)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'CONTENT_FETCH') {
    handleContentFetch(message.url, message.mode, message.timeout)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleDagFetch(
  url: string,
  method: string = 'GET',
  headers: Record<string, string> = {},
  body?: string
): Promise<{ success: boolean; data?: unknown; error?: string; status?: number; contentType?: string }> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Accept': 'application/json, text/html, text/plain, */*',
        ...headers
      },
      body
    });

    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      success: response.ok,
      data,
      status: response.status,
      contentType
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Fetch failed'
    };
  }
}

async function handleContentFetch(
  url: string,
  mode: string,
  timeout: number
): Promise<{ success: boolean; content?: string; metadata?: { wordCount: number; charCount: number; extractionTime: number }; error?: string }> {
  const startTime = Date.now();
  const fetchTimeout = timeout || 30000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CanvasOS/1.0)'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    let content: string;

    if (contentType.includes('application/json')) {
      content = JSON.stringify(await response.json(), null, 2);
    } else {
      content = await response.text();
    }

    const extractionTime = Date.now() - startTime;
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = content.length;

    if (mode === 'readability') {
      content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return {
      success: true,
      content,
      metadata: {
        wordCount,
        charCount,
        extractionTime
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Content fetch failed'
    };
  }
}

async function handleResearchUrl(url: string, taskId: string): Promise<{ success: boolean; error?: string }> {
  let tab: chrome.tabs.Tab | undefined;
  
  try {
    tab = await chrome.tabs.create({ url, active: false });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Research timeout')), RESEARCH_TIMEOUT);
    });

    const scrapePromise = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!tab?.id) throw new Error('Tab not available');
      
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
      });

      return result?.result as string;
    };

    const content = await Promise.race([scrapePromise(), timeoutPromise]);
    
    if (tab?.id) {
      await chrome.tabs.remove(tab.id);
    }

    const nodes = await getCanvasNodes();
    const newNode = {
      id: generateId(),
      type: 'summary' as const,
      content: { url, summary: content.slice(0, 2000) },
      position: { x: 100 + nodes.length * 20, y: 100 + nodes.length * 20 },
      size: { width: 350, height: 250 },
      title: `Research: ${new URL(url).hostname}`,
      createdAt: Date.now(),
      source: { type: 'research', ref: taskId }
    };
    
    await addCanvasNode(newNode);

    chrome.runtime.sendMessage({
      type: 'RESEARCH_COMPLETE',
      nodeId: newNode.id
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    if (tab?.id) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch {}
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Research failed' 
    };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('CanvasOS Agentic IDE installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('CanvasOS Agentic IDE started');
});
