const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extractText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data: data });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    // Group by Y
    const lines = {};
    for (const item of content.items) {
      const y = Math.round(item.transform[5] * 2) / 2;
      if (!lines[y]) lines[y] = [];
      lines[y].push({ text: item.str, x: item.transform[4] });
    }
    
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
    let pageText = `\n--- PAGE ${i} ---\n`;
    for (const y of sortedY) {
      lines[y].sort((a, b) => a.x - b.x);
      pageText += lines[y].map(i => i.text).join(' ') + '\n';
    }
    
    fullText += pageText;
  }
  
  fs.writeFileSync('raw_pdf_text.txt', fullText);
  console.log('Done writing to raw_pdf_text.txt');
}

extractText('Datacredito PN-72164237.pdf').catch(console.error);
