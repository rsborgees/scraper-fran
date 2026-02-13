const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1';
const html = fs.readFileSync(path.join(ARTIFACT_DIR, 'product_scroll_debug.html'), 'utf-8');

// Capturar conteúdo de scripts JSON-LD
const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
let match;
while ((match = scriptRegex.exec(html)) !== null) {
    try {
        const data = JSON.parse(match[1].trim());
        if (data['@type'] === 'Product') {
            console.log('📦 ENCONTRADO PRODUTO (JSON-LD)');
            console.log(`Nome: ${data.name}`);
            console.log(`URL: ${data.url}`);

            if (data.offers && data.offers.offers) {
                console.log(`Ofertas encontradas: ${data.offers.offers.length}`);
                data.offers.offers.forEach((o, i) => {
                    if (i < 5 || o.availability === 'https://schema.org/InStock') {
                        console.log(`- Offer ${i}: SKU=${o.sku}, Price=${o.price}, Avail=${o.availability}`);
                    }
                });
            }
        }
    } catch (e) {
        // Ignorar erros de JSON malformado
    }
}
