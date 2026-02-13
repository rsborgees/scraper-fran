const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1\\captured_novidades.html';
const content = fs.readFileSync(filePath, 'utf-8');

const linkRegex = /href="([^"]+)"/g;
let match;
const links = new Set();

while ((match = linkRegex.exec(content)) !== null) {
    links.add(match[1]);
}

const list = Array.from(links);
console.log(`Total links: ${list.length}`);

const productLike = list.filter(l => l.includes('/p') || /\d{6,}/.test(l));
console.log(`Product-like links (first 50):`);
console.log(JSON.stringify(productLike.slice(0, 50), null, 2));

const decoLinks = list.filter(l => l.includes('deco'));
console.log(`Deco links (first 10):`);
console.log(JSON.stringify(decoLinks.slice(0, 10), null, 2));
