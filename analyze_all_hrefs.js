const fs = require('fs');
const html = fs.readFileSync('debug_novidades.html', 'utf8');
const regex = /href="([^"]+)"/g;
let match;
const hrefs = new Set();
while ((match = regex.exec(html)) !== null) {
    hrefs.add(match[1]);
}
const sortedHrefs = Array.from(hrefs).sort();
fs.writeFileSync('all_hrefs.txt', sortedHrefs.join('\n'));
console.log(`Extracted ${sortedHrefs.length} unique hrefs to all_hrefs.txt`);
