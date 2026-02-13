const fs = require('fs');
const html = fs.readFileSync('debug_novidades.html', 'utf8');
const regex = /href="([^"]+)"/g;
let match;
const hrefs = [];
while ((match = regex.exec(html)) !== null) {
    hrefs.push(match[1]);
}

// Find product links: they usually contain a product name followed by a 6-digit ID and 4 or 5 digit color code
const productPattern = /-[0-9]{6}-[0-9]{4,5}/;
const productLinks = hrefs.filter(h => productPattern.test(h));

console.log('Detected Product Links:', JSON.stringify([...new Set(productLinks)].slice(0, 10), null, 2));
