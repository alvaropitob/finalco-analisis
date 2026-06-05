const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('Datacredito PN-72164237.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('raw_text_pdf_parse.txt', data.text);
    console.log('Saved to raw_text_pdf_parse.txt');
});
