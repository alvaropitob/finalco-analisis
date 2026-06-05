const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      fs.writeFileSync('raw_pdf_text_received.txt', body);
      console.log('Saved raw text from browser.');
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
      res.end('OK');
      process.exit(0);
    });
  } else if (req.method === 'OPTIONS') {
    res.writeHead(200, { 
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    res.end();
  }
});
server.listen(8766, () => console.log('Receiver listening on 8766'));
