import { chromium } from 'playwright';

async function testExtension() {
  console.log('Connecting to Chrome DevTools Protocol at localhost:9222...');
  
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('Connected to Chrome!');
    
    const contexts = browser.contexts();
    console.log(`Found ${contexts.length} context(s)`);
    
    const extensionPage = contexts.find(c => c.url().includes('chrome-extension://'));
    
    if (extensionPage) {
      const pages = extensionPage.pages();
      console.log(`Extension context has ${pages.length} page(s)`);
      
      for (const page of pages) {
        console.log(`Page: ${page.url()}`);
      }
    } else {
      console.log('No extension context found. Loading extension...');
      console.log('Please load the extension from the dist/ folder in chrome://extensions');
    }
    
    await browser.close();
  } catch (error) {
    console.error('Failed to connect:', error.message);
    console.log('\nMake sure Chrome is running with:');
    console.log('  chrome --remote-debugging-port=9222');
    process.exit(1);
  }
}

testExtension();
