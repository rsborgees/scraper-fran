
const { scrapeZZMall, parseProductZZMall } = require('./scrapers/zzmall/index');
const { initBrowser } = require('./browser_setup');

async function testFix() {
    const { browser, page } = await initBrowser();

    // Test URLs that were previously failing
    const urls = [
        'https://www.zzmall.com.br/bolsa-tote-media-metalasse-marrom/p/C5003600320003U', // Bag
        'https://www.zzmall.com.br/sandalia-rasteira-preto-croco/p/A1105700010191U',   // Sandal
        'https://www.zzmall.com.br/camiseta-vans-classic-ss-london-fog/p/V4701603210013U' // Shirt (should be ignored)
    ];

    console.log('--- TESTING ZZMALL FIX ---');

    const clothingTerms = ['vestido', 'blusa', 'casaco', 'saia', 'short', 'macacão', 'top', 'biquíni', 'body', 'camisa', 'jaqueta', 'blazer', 'pantalo', 'regata', 't-shirt', 'tricot', 'camiseta'];

    for (const url of urls) {
        console.log(`\nTesting URL: ${url}`);
        const product = await parseProductZZMall(page, url);

        if (product) {
            console.log(`Product Name: ${product.nome}`);
            console.log(`Category Detected: ${product.categoria}`);

            const normalizedCat = product.categoria ? product.categoria.toLowerCase() : '';
            const productNomeLower = product.nome.toLowerCase();
            const hasCalca = /\bcalça\b/i.test(normalizedCat) || /\bcalça\b/i.test(productNomeLower);
            const matchedClothingTerm = clothingTerms.find(term => {
                const regex = new RegExp(`\\b${term}\\b`, 'i');
                return regex.test(normalizedCat) || regex.test(productNomeLower);
            });

            let isCloth = !!matchedClothingTerm || hasCalca;
            if (normalizedCat === 'calçado' || normalizedCat === 'bolsa') {
                isCloth = false;
            }

            console.log(`Matched Term: ${matchedClothingTerm || 'none'}`);
            console.log(`Is Cloth: ${isCloth}`);

            if (url.includes('camiseta') && !isCloth) {
                console.log('❌ FAIL: Camiseta should have been flagged as cloth');
            } else if (!url.includes('camiseta') && isCloth) {
                console.log('❌ FAIL: Bag/Sandal should NOT have been flagged as cloth');
            } else {
                console.log('✅ PASS');
            }
        } else {
            console.log('❌ FAIL: Could not parse product');
        }
    }

    await browser.close();
}

testFix().catch(console.error);
