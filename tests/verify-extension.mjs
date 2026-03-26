import { readdir } from 'fs/promises';

const CDP_URL = 'http://localhost:9222';

async function testExtension() {
  console.log('Testing CanvasOS Extension...\n');
  
  try {
    const tabsRes = await fetch(`${CDP_URL}/json`);
    const tabs = await tabsRes.json();
    
    console.log(`Found ${tabs.length} open tabs`);
    
    for (const tab of tabs) {
      console.log(`  - ${tab.title}: ${tab.url}`);
    }
    
    console.log('\nExtension build output:');
    const files = await readdir('./dist');
    console.log('Files in dist/:');
    for (const file of files) {
      console.log(`  - ${file}`);
    }
    
    console.log('\nExtension is ready! Load it in Chrome from:');
    console.log('  1. Go to chrome://extensions');
    console.log('  2. Enable "Developer mode"');
    console.log('  3. Click "Load unpacked"');
    console.log('  4. Select the "dist" folder from this project');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testExtension();
