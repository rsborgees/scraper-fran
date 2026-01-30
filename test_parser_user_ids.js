const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');

async function testSpecificIds() {
    const { browser, context } = await initBrowser();
    const page = await context.newPage();

    const urls = [
        'https://secure.farmrio.com.br/vestido-midi-estampado-teresa-teresa_vestido-malha_bege-creme-358001-55721/p', // The one that should work
        'https://secure.farmrio.com.br/vestido-curto-estampado-papoula-papoula_localizado-mini_roxo-ameixa-356090-56124/p', // Should fail with "mini"
        'https://secure.farmrio.com.br/maio-fivela-surreal-preto-358356-0005/p' // Should fail with "swimwear"
    ];

    for (const url of urls) {
        console.log(`\n--- Testing URL: ${url} ---`);
        const product = await parseProduct(page, url);
        if (product) {
            console.log(`✅ SUCCESS: ${product.nome}`);
        } else {
            console.log(`❌ FAILED (See log above)`);
        }
    }

    await browser.close();
}

testSpecificIds();
