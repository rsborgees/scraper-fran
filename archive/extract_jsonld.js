const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ARTIFACT_DIR = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1';
const html = fs.readFileSync(path.join(ARTIFACT_DIR, 'product_scroll_debug.html'), 'utf-8');

const dom = new JSDOM(html);
const scripts = Array.from(dom.window.document.querySelectorAll('script[type="application/ld+json"]'));

console.log(`✅ Scripts JSON-LD encontrados: ${scripts.length}`);

scripts.forEach((s, i) => {
    try {
        const data = JSON.parse(s.textContent);
        console.log(`--- Script ${i} (${data['@type'] || 'Sem Tipo'}) ---`);
        if (data['@type'] === 'Product') {
            console.log('📦 Encontrado Produto!');
            console.log(`Nome: ${data.name}`);
            console.log(`Ofertas: ${data.offers?.offers?.length || 0}`);
            if (data.offers?.offers) {
                const sampleOffer = data.offers.offers[0];
                console.log('Amostra de Oferta:', JSON.stringify(sampleOffer, null, 2));
            }
        }
    } catch (e) {
        console.log(`❌ Erro ao processar script ${i}: ${e.message}`);
    }
});
