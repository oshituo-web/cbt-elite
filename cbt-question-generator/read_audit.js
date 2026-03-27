const fs = require('fs');
const content = fs.readFileSync('audit_report_final.txt', 'utf16le');
console.log(content);
