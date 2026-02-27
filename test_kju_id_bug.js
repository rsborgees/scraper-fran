const { initBrowser } = require('./browser_setup');
const { parseProductKJU } = require('./scrapers/kju');

async function testKjuIdExtraction() {
    const { browser, page } = await initBrowser();
    const testUrls = [
        'https://www.kjubrasil.com/bolsa-farm-mimo-praia-bahia-souvenir-brasil-farm-etc-inverno-2026/',
        'https://www.kjubrasil.com/vela-selos-misticos-coracao-rosa-manjuba-farm-etc-inverno-2026/'
    ];

    try {
        for (const url of testUrls) {
            console.log(`\nTesting: ${url}`);
            const product = await parseProductKJU(page, url);
            if (product) {
                console.log(`ID: ${product.id} | Name: ${product.nome}`);
            }
        }
    } finally {
        await browser.close();
    }
}

testKjuIdExtraction();
