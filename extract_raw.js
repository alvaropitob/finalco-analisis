const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle2' });
  
  // Upload the file
  const fileInput = await page.$('#pdf-input');
  await fileInput.uploadFile('Datacredito PN-72164237.pdf');
  
  // Wait for processing to complete
  await page.waitForFunction(() => {
    const el = document.getElementById('status-msg');
    return el && (el.textContent.includes('leídas') || el.classList.contains('error'));
  }, { timeout: 30000 });
  
  // Get raw text
  const rawText = await page.evaluate(() => {
    return document.getElementById('raw-text').textContent;
  });
  
  fs.writeFileSync('raw_text_dump.txt', rawText);
  console.log('Successfully saved raw text to raw_text_dump.txt');
  
  await browser.close();
}

run().catch(console.error);
