 
console.log('Testing DAG with js-execution node...');

async function testDAGWithJsExecution() {
  const result = await window.toolTester.invokeTool('execute_dag', {
    nodes: [
      {
        id: 'calc-node',
        type: 'js-execution',
        params: { code: 'return 1 + 1' },
        dependencies: []
      }
    ]
  });
  
  console.log('DAG execution started:', result);
  
  await new Promise((resolve) => {
    const unsubscribe = registerDAGExecutionCallback((planId, nodes, status) => {
      console.log('DAG execution completed:', status, 'planId:', planId);
      
      const calcNode = nodes.find(n => n.id === 'calc-node');
      console.log('calc-node result:', calcNode.result);
      resolve();
      unsubscribe();
    });
  });
}

testDAGWithJsExecution();
