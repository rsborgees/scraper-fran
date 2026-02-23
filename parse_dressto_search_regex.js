const fs = require('fs');

const html = fs.readFileSync('dressto_search_result.html', 'utf8');

// Procura por href contendo /p e classes relacionadas a vtex/product
const regex = /href="([^"]+\/p)"[^>]*class="([^"]+)"/g;
let match;
const results = [];

while ((match = regex.exec(html)) !== null) {
    results.push({ href: match[1], className: match[2] });
}

console.log(`Found ${results.length} potential product links.`);

results.slice(0, 10).forEach((res, i) => {
    console.log(`Link ${i + 1}:`);
    console.log(`  Href: ${res.href}`);
    console.log(`  Classes: ${res.className}`);
});

// Outro teste: procurar por "product-summary"
const regex2 = /class="([^"]*product-summary[^"]*)"[^>]*href="([^"]+)"/g;
while ((match = regex2.exec(html)) !== null) {
    console.log(`Found via product-summary: ${match[2]}`);
}
