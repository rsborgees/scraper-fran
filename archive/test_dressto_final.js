// Test Final Fix for DressTo
const { chromium } = require('playwright');
const { parseProductDressTo } = require('./scrapers/dressto/parser');

async function test() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const url = 'https://www.dressto.com.br/vestido-cropped-estampa-mares-01342814-2384/p';

    console.log('🧪 Testing DressTo Parser Fix...\n');

    const product = await parseProductDressTo(page, url);

    if (product) {
        console.log('\n✅ PARSED PRODUCT:');
        console.log('   ID:', product.id);
        console.log('   Nome:', product.nome);
        console.log('   Tamanhos:', product.tamanhos);
        console.log('   Preço:', product.precoAtual);
        console.log('   ImageUrl:', product.imageUrl ? 'OK' : 'MISSING');

        // Check for duplicates in sizes
        const unique = [...new Set(product.tamanhos)];
        if (unique.length === product.tamanhos.length) {
            console.log('\n✅ No duplicate sizes found!');
        } else {
            console.log('\n⚠️ WARNING: Duplicate sizes detected!');
        }

        // Check for "DISPONÍVEL" in sizes
        const hasDisponivel = product.tamanhos.some(t => t.includes('DISPONÍVEL'));
        if (hasDisponivel) {
            console.log('\n❌ ERROR: Size array contains "DISPONÍVEL" text!');
        } else {
            console.log('\n✅ No "DISPONÍVEL" text in sizes!');
        }

        console.log('\n📊 Expected: [PP, P, M, G, GG] or similar (without "DISPONÍVEL")');
    } else {
        console.log('\n❌ Failed to parse product');
    }

    await browser.close();
}

test().catch(console.error);
