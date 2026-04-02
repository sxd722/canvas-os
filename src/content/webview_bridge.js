/**
 * webview_bridge content script for DOM extraction and interaction.
 * Runs inside webview iframes embedded in the CanvasOS popup.
 * Listens for postMessage commands from the popup parent, extracts
 * interactive elements, performs click/fill/select actions, and
 * navigates back via history.back().
 *
 * Communication: popup (parent) --postMessage--> iframe (this script) --postMessage--> popup
 * Nonce-based validation prevents cross-origin message interference.
 */

// Channel nonce for message validation — set on first EXTRACT_CONTENT
let _channelNonce = '';

// --- Message listener ---
window.addEventListener('message', function (event) {
  // Only process messages from parent (popup) window
  if (event.source !== window.parent) return;

  var msg = event.data;
  if (!msg || !msg.type) return;

  // Set nonce on first EXTRACT_CONTENT (bootstrap)
  if (msg.type === 'EXTRACT_CONTENT' && msg.nonce) {
    _channelNonce = msg.nonce;
  }

  // Validate nonce for all messages after bootstrap
  if (_channelNonce && msg.nonce !== _channelNonce) return;

  switch (msg.type) {
    case 'EXTRACT_CONTENT':
      handleExtract(msg.intent);
      break;
    case 'INTERACT_ELEMENT':
      handleInteract(msg);
      break;
    case 'NAVIGATE_BACK':
      handleNavigateBack();
      break;
    case 'GET_PAGE_STATUS':
      handleGetPageStatus();
      break;
    case 'EXTRACT_BY_SELECTOR':
      handleExtractBySelector(msg);
      break;
  }
});

// --- EXTRACT_CONTENT handler ---
function handleExtract(_intent) {
  try {
    var interactiveElements = extractInteractiveElements();
    var semanticChunks = extractSemanticChunks();
    var summary = extractPageSummary();
    window.parent.postMessage({
      type: 'CONTENT_RESPONSE',
      nonce: _channelNonce,
      extraction: {
        url: location.href,
        title: document.title,
        summary: summary,
        information_chunks: semanticChunks,
        interactive_elements: interactiveElements,
        extractionMethod: 'semantic-chunk',
        extractedAt: Date.now(),
        totalChunksFound: semanticChunks.length,
        totalInteractiveFound: interactiveElements.length,
        success: true
      }
    }, '*');
  } catch (err) {
    window.parent.postMessage({
      type: 'CONTENT_RESPONSE',
      nonce: _channelNonce,
      extraction: {
        url: location.href,
        title: document.title,
        summary: '',
        information_chunks: [],
        interactive_elements: [],
        extractionMethod: 'semantic-chunk',
        extractedAt: Date.now(),
        totalChunksFound: 0,
        totalInteractiveFound: 0,
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }, '*');
  }
}

// --- INTERACT_ELEMENT handler ---
function handleInteract(msg) {
  try {
    var el = document.querySelector(msg.selector);
    if (!el) {
      window.parent.postMessage({
        type: 'INTERACTION_RESULT',
        nonce: _channelNonce,
        success: false,
        error: 'Element not found: ' + msg.selector
      }, '*');
      return;
    }

    var currentUrl = location.href;

    try {
      if (msg.action === 'click') {
        el.click();
      } else if (msg.action === 'fill') {
        el.value = msg.value || '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (msg.action === 'select') {
        el.value = msg.value || '';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (interactionErr) {
      window.parent.postMessage({
        type: 'INTERACTION_RESULT',
        nonce: _channelNonce,
        success: false,
        error: 'Interaction failed: ' + (interactionErr instanceof Error ? interactionErr.message : String(interactionErr))
      }, '*');
      return;
    }

    // Wait for potential navigation (2 second delay)
    setTimeout(function () {
      var newUrl = location.href;
      var navigated = newUrl !== currentUrl;
      window.parent.postMessage({
        type: 'INTERACTION_RESULT',
        nonce: _channelNonce,
        success: true,
        newUrl: navigated ? newUrl : undefined,
        navigated: navigated
      }, '*');
    }, 2000);

  } catch (err) {
    window.parent.postMessage({
      type: 'INTERACTION_RESULT',
      nonce: _channelNonce,
      success: false,
      error: 'Interaction failed: ' + (err instanceof Error ? err.message : String(err))
    }, '*');
  }
}

// --- NAVIGATE_BACK handler ---
function handleNavigateBack() {
  var timeoutId;
  var handled = false;

  function onPopState() {
    if (handled) return;
    handled = true;
    clearTimeout(timeoutId);
    window.removeEventListener('popstate', onPopState);
    // Small delay to let page settle after navigation
    setTimeout(function () {
      window.parent.postMessage({
        type: 'NAVIGATION_COMPLETE',
        nonce: _channelNonce,
        url: location.href,
        title: document.title
      }, '*');
    }, 500);
  }

  window.addEventListener('popstate', onPopState);

  timeoutId = setTimeout(function () {
    if (handled) return;
    handled = true;
    window.removeEventListener('popstate', onPopState);
    window.parent.postMessage({
      type: 'NAVIGATION_COMPLETE',
      nonce: _channelNonce,
      url: '',
      title: '',
      error: 'Navigation back timed out after 10 seconds'
    }, '*');
  }, 10000);

  history.back();
}

// --- GET_PAGE_STATUS handler ---
function handleGetPageStatus() {
  window.parent.postMessage({
    type: 'PAGE_STATUS',
    nonce: _channelNonce,
    status: document.readyState === 'loading' ? 'loading' : 'loaded',
    url: location.href
  }, '*');
}

// --- EXTRACT_BY_SELECTOR handler ---
function handleExtractBySelector(msg) {
  try {
    var results = [];
    var els = document.querySelectorAll(msg.selector);
    els.forEach(function (el) {
      var text = (el.innerText || '').trim();
      if (!text && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
        text = (el.value || '').trim();
      }
      if (text) results.push(text);
    });
    window.parent.postMessage({
      type: 'EXTRACT_RESULT',
      nonce: _channelNonce,
      data: results.join('\n'),
      success: true
    }, '*');
  } catch (err) {
    window.parent.postMessage({
      type: 'EXTRACT_RESULT',
      nonce: _channelNonce,
      data: '',
      success: false,
      error: 'Invalid selector: ' + msg.selector
    }, '*');
  }
}

// --- Helper: Check if element is hidden (width/height <= 0) ---
function isHidden(rect) {
  return rect.width <= 0 || rect.height <= 0;
}

// --- Helper: Find structural context for an element ---
function findStructuralContext(el) {
  var context = [];
  var current = el.parentElement;
  
  // Walk up the DOM tree to find structural context
  while (current && current !== document.body) {
    // Check for headings (h1-h6)
    if (/^H[1-6]$/i.test(current.tagName)) {
      var headingText = (current.textContent || '').trim();
      if (headingText) context.unshift(headingText);
    }
    // Check for table headers (th)
    else if (current.tagName === 'TH') {
      var headerText = (current.textContent || '').trim();
      if (headerText) context.unshift(headerText);
    }
    // Check for aria-labels
    var ariaLabel = current.getAttribute('aria-label');
    if (ariaLabel) context.unshift(ariaLabel);
    
    current = current.parentElement;
    
    // Limit context depth to avoid excessive nesting
    if (context.length >= 3) break;
  }
  
  return context;
}

// --- Extract all interactive elements from the DOM ---
function extractInteractiveElements() {
  var elements = [];

  // Links
  var links = document.querySelectorAll('a[href]');
  links.forEach(function (el, index) {
    var href = el.href || '';
    var text = (el.textContent || '').trim();
    if (!text && !href) return;
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return; // Filter hidden
    elements.push({
      id: 'link-' + index,
      selector: generateSelector(el),
      xpath: getXPath(el),
      type: 'link',
      text: text.substring(0, 100),
      description: 'Link to ' + (href.length > 80 ? href.substring(0, 80) + '...' : href),
      href: href,
      relevanceScore: 0,
      boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    });
  });

  // Buttons
  var buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]');
  buttons.forEach(function (el, index) {
    var text = (el.textContent || '').trim();
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    elements.push({
      id: 'button-' + index,
      selector: generateSelector(el),
      xpath: getXPath(el),
      type: 'button',
      text: text.substring(0, 100),
      description: text || 'Button',
      relevanceScore: 0,
      boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    });
  });

  // Inputs, selects, textareas
  var inputs = document.querySelectorAll('input:not([type="submit"]):not([type="hidden"]), select, textarea');
  inputs.forEach(function (el, index) {
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    var inputType = el.tagName.toLowerCase() === 'input'
      ? el.type || 'text'
      : el.tagName.toLowerCase();
    var placeholder = el.placeholder || '';
    var text = (el.value || '').trim().substring(0, 100);
    var desc = inputType + ' input';
    if (placeholder) desc += ': ' + placeholder;
    if (el.tagName.toLowerCase() === 'select') {
      var selected = el.options && el.options[el.selectedIndex];
      if (selected) desc = 'Select: ' + (selected.text || '');
    }
    elements.push({
      id: 'input-' + index,
      selector: generateSelector(el),
      xpath: getXPath(el),
      type: inputType,
      text: text,
      description: desc,
      inputType: el.type || undefined,
      placeholder: placeholder || undefined,
      relevanceScore: 0,
      boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    });
  });

  // Clickable divs with onclick, role=button, or role=link
  var clickables = document.querySelectorAll('[onclick], [role="button"], [role="link"]');
  clickables.forEach(function (el, index) {
    // Skip if already captured as button
    var tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a') return;
    var text = (el.textContent || '').trim();
    var rect = el.getBoundingClientRect();
    if (isHidden(rect)) return;
    elements.push({
      id: 'clickable-' + index,
      selector: generateSelector(el),
      xpath: getXPath(el),
      type: 'clickable-div',
      text: text.substring(0, 100),
      description: text || 'Clickable element',
      relevanceScore: 0,
      boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    });
  });

  return elements;
}

// --- Extract semantic chunks with structural context ---
function extractSemanticChunks() {
  var chunks = [];
  var extractedTexts = new Set(); // For deduplication
  
  // Extract text content from semantic elements (p, span, td)
  var textElements = document.querySelectorAll('p, span, td, li');
  textElements.forEach(function (el, index) {
    var text = (el.textContent || '').trim();
    if (!text || text.length < 3) return; // Skip very short text
    if (extractedTexts.has(text)) return; // Skip duplicate
    
    var rect = el.getBoundingClientRect();
    if (isHidden(rect)) return;
    
    extractedTexts.add(text);
    
    // Find structural context (headings, table headers, aria-labels)
    var context = findStructuralContext(el);
    
    chunks.push({
      id: 'chunk-' + index,
      selector: generateSelector(el),
      xpath: getXPath(el),
      type: 'text',
      text: text.substring(0, 200),
      context: context,
      description: context.length > 0 ? context.join(' > ') + ' > ' + text.substring(0, 50) : text.substring(0, 100),
      relevanceScore: 0,
      boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    });
  });
  
  return chunks;
}

// --- Extract page summary ---
function extractPageSummary() {
  var title = document.title || '';
  var metaDesc = '';
  var metaEl = document.querySelector('meta[name="description"]');
  if (metaEl) metaDesc = metaEl.getAttribute('content') || '';

  var headings = [];
  var headingEls = document.querySelectorAll('h1, h2, h3');
  headingEls.forEach(function (el) {
    var t = (el.textContent || '').trim();
    if (t.length > 0) headings.push(t);
  });
  headings = headings.slice(0, 5);

  // First paragraph text (T022)
  var firstParagraph = '';
  var firstP = document.querySelector('p');
  if (firstP) {
    firstParagraph = (firstP.textContent || '').trim().substring(0, 300);
  }

  var parts = [];
  if (title) parts.push(title);
  if (metaDesc) parts.push(metaDesc);
  if (headings.length > 0) parts.push(headings.join(' | '));
  if (firstParagraph) parts.push(firstParagraph);

  return parts.join('. ');
}

// --- Generate a CSS selector for an element ---
function generateSelector(el) {
  if (el.id) return '#' + el.id;

  var tag = el.tagName.toLowerCase();

  var dataTestId = el.getAttribute('data-testid');
  if (dataTestId) return '[data-testid="' + dataTestId + '"]';

  var dataAction = el.getAttribute('data-action');
  if (dataAction) return '[data-action="' + dataAction + '"]';

  if (el.classList && el.classList.length > 0) {
    var classes = [];
    el.classList.forEach(function (c) { classes.push('.' + c); });
    return tag + classes.join('');
  }

  // Fallback: nth-child path
  var parent = el.parentElement;
  if (parent) {
    var siblings = Array.prototype.slice.call(parent.children);
    var idx = siblings.indexOf(el);
    return tag + ':nth-child(' + (idx + 1) + ')';
  }
  return tag;
}

// --- Generate XPath for an element ---
function getXPath(el) {
  var parts = [];
  var current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    var parent = current.parentElement;
    if (!parent) break;
    var siblings = Array.prototype.slice.call(parent.children);
    var index = siblings.indexOf(current);
    parts.unshift(current.tagName.toLowerCase() + '[' + (index + 1) + ']');
    current = parent;
  }
  return '/' + parts.join('/');
}
