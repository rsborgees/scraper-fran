const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('dressto_search_result.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

const links = Array.from(document.querySelectorAll('a'));
const productLinks = links.filter(a => a.href.includes('/p') || a.className.includes('product-summary'));

console.log(`Found ${links.length} total links.`);
console.log(`Found ${productLinks.length} potential product links.`);

productLinks.forEach((a, i) => {
    console.log(`Link ${i + 1}:`);
    console.log(`  Text: ${a.textContent.trim().substring(0, 50)}`);
    console.log(`  Href: ${a.href}`);
    console.log(`  Classes: ${a.className}`);
});
