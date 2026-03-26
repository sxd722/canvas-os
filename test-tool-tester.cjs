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

async function testToolTester() {
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
        if (text?.includes('[TEST]')) {
          console.log('LOG:', text)
        }
      }
    } catch (e) {}
  })

  // Test 1: Get available tools
  console.log('Test 1: Getting available tools...')
  const toolsResult = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const tester = new ToolTester(() => {}, () => {});
        const tools = tester.getAvailableTools();
        return JSON.stringify({
          toolCount: tools.length,
          tools: tools.map(t => t.name)
        });
      })()
    `
  })
  
  const toolsData = JSON.parse(toolsResult.result?.result?.value || '{}')
  console.log('Available tools:', toolsData)

  // Test 2: Test open_web_view tool
  console.log('\nTest 2: Testing open_web_view tool...')
  const openViewResult = await send('Runtime.evaluate', {
    expression: `
      (async function() {
        const canvasNodes = [];
        const messages = [];
        
        const tester = new ToolTester(
          (updater) => {
            if (typeof updater === 'function') {
              const prev = canvasNodes;
              const result = updater(prev);
              if (Array.isArray(result)) {
                canvasNodes.length = 0;
                canvasNodes.push(...result);
              }
            }
          },
          (updater) => {
            if (typeof updater === 'function') {
              const prev = messages;
              const result = updater(prev);
              if (Array.isArray(result)) {
                messages.length = 0;
                messages.push(...result);
              }
            }
          }
        );
        
        const result = await tester.invokeTool('open_web_view', { 
          url: 'https://example.com',
          title: 'Example Domain'
        });
        
        return JSON.stringify({
          success: result.success,
          toolName: result.toolName,
          output: result.output,
          canvasNodesCount: canvasNodes.length,
          messagesCount: messages.length
        });
      })()
    `,
    awaitPromise: true
  })
  
  const openViewData = JSON.parse(openViewResult.result?.result?.value || '{}')
  console.log('open_web_view result:', openViewData)

  // Test 3: Test read_artifact_content tool
  console.log('\nTest 3: Testing read_artifact_content tool...')
  const readArtifactResult = await send('Runtime.evaluate', {
    expression: `
      (async function() {
        const canvasNodes = [
          {
            id: 'test-artifact-123',
            type: 'file',
            content: { filename: 'test.txt', content: 'Hello World', fullLength: 11 },
            title: 'test.txt'
          }
        ];
        const messages = [];
        
        const tester = new ToolTester(
          (updater) => {
            if (typeof updater === 'function') {
              const result = updater(canvasNodes);
              if (Array.isArray(result)) {
                canvasNodes.length = 0;
                canvasNodes.push(...result);
              }
            }
          },
          (updater) => {
            if (typeof updater === 'function') {
              const result = updater(messages);
              if (Array.isArray(result)) {
                messages.length = 0;
                messages.push(...result);
              }
            }
          }
        );
        
        const result = await tester.invokeTool('read_artifact_content', { 
          artifactId: 'test-artifact-123'
        });
        
        return JSON.stringify({
          success: result.success,
          toolName: result.toolName,
          hasOutput: !!result.output
        });
      })()
    `,
    awaitPromise: true
  })
  
  const readData = JSON.parse(readArtifactResult.result?.result?.value || '{}')
  console.log('read_artifact_content result:', readData)

  // Test 4: Test execute_dag tool
  console.log('\nTest 4: Testing execute_dag tool...')
  const dagResult = await send('Runtime.evaluate', {
    expression: `
      (async function() {
        const canvasNodes = [];
        const messages = [];
        
        const tester = new ToolTester(
          (updater) => {
            if (typeof updater === 'function') {
              const result = updater(canvasNodes);
              if (Array.isArray(result)) {
                canvasNodes.length = 0;
                canvasNodes.push(...result);
              }
            }
          },
          (updater) => {
            if (typeof updater === 'function') {
              const result = updater(messages);
              if (Array.isArray(result)) {
                messages.length = 0;
                messages.push(...result);
              }
            }
          }
        );
        
        const result = await tester.invokeTool('execute_dag', { 
          nodes: [
            {
              id: 'fetch-data',
              type: 'web-operation',
              params: { url: 'https://api.example.com/data', action: 'fetch' },
              dependencies: []
            }
          ]
        });
        
        return JSON.stringify({
          success: result.success,
          toolName: result.toolName,
          nodeCount: result.output?.nodeCount
        });
      })()
    `,
    awaitPromise: true
  })
  
  const dagData = JSON.parse(dagResult.result?.result?.value || '{}')
  console.log('execute_dag result:', dagData)

  // Test 5: Run default test suite
  console.log('\nTest 5: Running default test suite...')
  const suiteResult = await send('Runtime.evaluate', {
    expression: `
      (async function() {
        const canvasNodes = [];
        const messages = [];
        
        const tester = new ToolTester(
          (updater) => {
            if (typeof updater === 'function') {
              const result = updater(canvasNodes);
              if (Array.isArray(result)) {
                canvasNodes.length = 0;
                canvasNodes.push(...result);
              }
            }
          },
          (updater) => {
            if (typeof updater === 'function') {
              const result = updater(messages);
              if (Array.isArray(result)) {
                messages.length = 0;
                messages.push(...result);
              }
            }
          }
        );
        
        const suite = tester.getDefaultTestSuite();
        const results = await tester.runTestSuite(suite);
        
        const passed = results.filter(r => r.success).length;
        
        return JSON.stringify({
          suiteName: suite.name,
          totalTests: results.length,
          passed,
          failed: results.length - passed,
          results: results.map(r => ({
            tool: r.toolName,
            success: r.success,
            duration: r.duration
          }))
        });
      })()
    `,
    awaitPromise: true
  })
  
  const suiteData = JSON.parse(suiteResult.result?.result?.value || '{}')
  console.log('Test suite result:', JSON.stringify(suiteData, null, 2))

  console.log('\n' + '='.repeat(60))
  console.log('TOOL TESTER VERIFICATION COMPLETE')
  console.log('='.repeat(60))
  
  if (suiteData.passed === suiteData.totalTests) {
    console.log('✓ All tool tests passed!')
  } else {
    console.log(`✗ ${suiteData.totalTests - suiteData.passed}/${suiteData.totalTests} tests failed`)
  }
  
  ws.close()
}

testToolTester().catch(console.error)
