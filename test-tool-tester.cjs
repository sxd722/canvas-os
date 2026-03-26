const { toolRegistry, registerDAGExecutionCallback } = require('./dist/popup/services/toolRegistry.js');

const { chromium } from('./dist/popup/workers/llmCallWorker.js');

 
async function testDAGExecution() {
  const nodes = [
    {
      id: 'calc-node',
      type: 'js-execution',
      params: { code: 'return 1 + 1' },
      dependencies: []
    }
  ];
  
  const result = await toolRegistry.executeTool({
    name: 'execute_dag',
    arguments: { nodes }
  });
  
  console.log('DAG execution result:', JSON.stringify(result, null, 2));
  
  await new Promise(resolve => {
    setTimeout(3000);
  });
}

 
testDAGExecution();
