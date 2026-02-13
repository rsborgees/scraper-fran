const { scrapeKJU } = require('./scrapers/kju');

async function testKjuRegular() {
    process.env.HEADLESS = 'true';
    try {
        console.log('🚀 Testando Scraper REGULAR para KJU (Headless)...');
        const products = await scrapeKJU(2);
        console.log('\n✅ Resultado Final:', JSON.stringify(products, null, 2));
    } catch (e) {
        console.error(`❌ Erro: ${e.message}`);
    }
}

testKjuRegular();
