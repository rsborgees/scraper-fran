const fs = require('fs');
const html = fs.readFileSync('debug_novidades.html', 'utf8');
const regex = /href="([^"]+)"/g;
let match;
const hrefs = [];
while ((match = regex.exec(html)) !== null) {
    hrefs.push(match[1]);
}
console.log(JSON.stringify(hrefs.slice(0, 200), null, 2));
