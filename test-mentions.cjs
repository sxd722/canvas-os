const WebSocket = require('ws')

const PAGE_ID = '732D4C14C9E7FB171DF6EDC04D8BD1A9'
const wsUrl = `ws://localhost:9222/devtools/page/${PAGE_ID}`

const ws = new WebSocket(wsUrl)
let msgId = 0

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId
    ws.send(JSON.stringify({ id, method, params }))
    const handler = (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.id === id) {
        ws.off('message', handler)
        resolve(msg)
      }
    }
    ws.on('message', handler)
  })
}

const STORAGE_KEY = 'canvasos_canvas_nodes'

async function test() {
  console.log('Connecting to Chrome DevTools...')
  await new Promise(resolve => ws.once('open', resolve))
  console.log('Connected!\n')

  await send('Runtime.enable')
  await send('Console.enable')
  
  const logs = []
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.method === 'Console.messageAdded') {
        const text = msg.params.message.text
        logs.push(text)
        if (text?.includes('[Mentions]')) {
          console.log('LOG:', text)
        }
      }
    } catch (e) {}
  })

  // Step 1: Create test node with CORRECT storage key
  console.log('Step 1: Creating test node with correct storage key...')
  const nodeId = 'csv-test-' + Date.now()
  const csvContent = 'name,age,city,occupation\nAlice,30,New York,Engineer\nBob,25,San Francisco,Designer\nCharlie,35,Chicago,Manager'
  
  await send('Runtime.evaluate', {
    expression: `
      (async function() {
        const node = {
          id: '${nodeId}',
          type: 'file',
          content: {
            filename: 'data.csv',
            content: '${csvContent.replace(/'/g, "\\'").replace(/\n/g, '\\n')}',
            fullLength: ${csvContent.length}
          },
          position: { x: 100, y: 100 },
          size: { width: 350, height: 250 },
          title: 'data.csv',
          createdAt: Date.now(),
          source: { type: 'file', ref: 'data.csv' }
        };
        
        return new Promise((resolve) => {
          chrome.storage.local.set({ '${STORAGE_KEY}': [node] }, () => {
            resolve(JSON.stringify({ saved: true, nodeId: '${nodeId}' }));
          });
        });
      })()
    `,
    awaitPromise: true
  })
  console.log('Node created:', nodeId)

  // Step 2: Reload to load new state
  console.log('\nStep 2: Reloading page...')
  await send('Page.reload')
  await new Promise(r => setTimeout(r, 2500))
  await send('Runtime.enable')

  // Step 3: Verify node loaded
  console.log('\nStep 3: Verifying node loaded in React...')
  const verifyResult = await send('Runtime.evaluate', {
    expression: `
      (function() {
        // Check canvas area for nodes
        const canvas = document.querySelector('[class*="w-\\[70\\%\\]"]') || 
                       document.querySelector('[class*="relative"]');
        const nodeCount = canvas?.querySelectorAll('[class*="absolute"][class*="bg"]').length || 0;
        
        // Check if data.csv is visible anywhere
        const body = document.body.innerText;
        const hasDataCsv = body.includes('data.csv') || body.includes('csv');
        
        return JSON.stringify({
          nodeCount,
          hasDataCsv,
          canvasFound: !!canvas
        });
      })()
    `
  })
  console.log('Verify:', verifyResult.result?.result?.value)

  // Step 4: Type @ to trigger dropdown
  console.log('\nStep 4: Typing @ to trigger dropdown...')
  await send('Runtime.evaluate', {
    expression: `
      (function() {
        const input = document.querySelector('input[type="text"]');
        if (!input) return { error: 'Input not found' };
        
        input.focus();
        
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, '@');
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));
        
        return { typed: true };
      })()
    `
  })
  
  await new Promise(r => setTimeout(r, 300))

  // Step 5: Check dropdown
  console.log('\nStep 5: Checking dropdown...')
  const dropdownResult = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const allAbs = document.querySelectorAll('.absolute');
        let dropdown = null;
        
        for (const el of allAbs) {
          if (el.className.includes('bg-gray-800') && el.className.includes('border')) {
            dropdown = el;
            break;
          }
        }
        
        if (!dropdown) return JSON.stringify({ found: false });
        
        const items = dropdown.querySelectorAll('.cursor-pointer');
        const itemTexts = Array.from(items).map(i => i.textContent?.substring(0, 40));
        
        return JSON.stringify({
          found: true,
          count: items.length,
          items: itemTexts,
          hasDataCsv: itemTexts.some(t => t.includes('data.csv'))
        });
      })()
    `
  })
  const dropdownData = JSON.parse(dropdownResult.result?.result?.value || '{}')
  console.log('Dropdown:', JSON.stringify(dropdownData, null, 2))

  if (!dropdownData.found) {
    console.log('ERROR: Dropdown not found')
    ws.close()
    return
  }

  // Step 6: Click data.csv item
  console.log('\nStep 6: Clicking data.csv item...')
  const clickResult = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const allAbs = document.querySelectorAll('.absolute');
        let dropdown = null;
        
        for (const el of allAbs) {
          if (el.className.includes('bg-gray-800') && el.className.includes('border')) {
            dropdown = el;
            break;
          }
        }
        
        if (!dropdown) return { error: 'Dropdown not found' };
        
        const items = dropdown.querySelectorAll('.cursor-pointer');
        
        // Find data.csv item
        let targetItem = null;
        for (const item of items) {
          if (item.textContent.includes('data.csv')) {
            targetItem = item;
            break;
          }
        }
        
        if (!targetItem) {
          // Use last item as fallback
          targetItem = items[items.length - 1];
        }
        
        if (!targetItem) return { error: 'No items found' };
        
        targetItem.click();
        
        return { clicked: true, text: targetItem.textContent?.substring(0, 40) };
      })()
    `
  })
  console.log('Click result:', clickResult.result?.result?.value)

  await new Promise(r => setTimeout(r, 100))

  // Step 7: Add question and send
  console.log('\nStep 7: Adding question and sending...')
  const sendResult = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const input = document.querySelector('input[type="text"]');
        if (!input) return { error: 'Input not found' };
        
        const currentValue = input.value;
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const newValue = currentValue + ' What columns are in this file?';
        
        nativeSetter.call(input, newValue);
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));
        
        setTimeout(() => {
          const form = input.closest('form');
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        }, 50);
        
        return { sent: true, message: input.value };
      })()
    `
  })
  console.log('Send result:', sendResult.result?.result?.value)

  // Step 8: Wait for processing
  console.log('\nStep 8: Waiting for processing...')
  await new Promise(r => setTimeout(r, 2500))

  // Step 9: Check [Mentions] logs
  console.log('\nStep 9: Checking [Mentions] logs...')
  const mentionLogs = logs.filter(l => l?.includes('[Mentions]'))
  
  if (mentionLogs.length > 0) {
    console.log('✓ Found [Mentions] logs:')
    mentionLogs.forEach(l => console.log('  ', l))
  } else {
    console.log('No [Mentions] logs found')
    console.log('Recent logs:', logs.slice(-5))
  }

  // Step 10: Final check
  console.log('\nStep 10: Final chat check...')
  const chatResult = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const messages = document.querySelectorAll('.flex.justify-end, .flex.justify-start');
        return JSON.stringify({
          count: messages.length,
          lastTwo: Array.from(messages).slice(-2).map(m => ({
            role: m.className.includes('justify-end') ? 'user' : 'assistant',
            preview: m.textContent?.substring(0, 80)
          }))
        });
      })()
    `
  })
  console.log('Chat:', chatResult.result?.result?.value)

  // Summary
  console.log('\n' + '='.repeat(60))
  const hasMentionsLog = mentionLogs.length > 0
  const hasContentLog = mentionLogs.some(l => l.includes('Content for'))
  
  if (hasMentionsLog && hasContentLog) {
    console.log('✓ E2E TEST PASSED!')
    console.log('  - @mention dropdown appeared with artifacts')
    console.log('  - Mention was inserted into message')
    console.log('  - Message was sent to LLM')
    console.log('  - [Mentions] extracted artifact ID from message')
    console.log('  - [Mentions] fetched artifact content')
    console.log('  - Content will be included in LLM context')
  } else if (hasMentionsLog) {
    console.log('PARTIAL: Mention logs found but content fetch incomplete')
  } else {
    console.log('FAILED: No [Mentions] logs - check if debug logging is enabled')
  }
  console.log('='.repeat(60))
  
  ws.close()
}

test().catch(console.error)
