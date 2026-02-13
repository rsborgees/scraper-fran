const { initBrowser } = require('./browser_setup');
const { parseProductKJU } = require('./scrapers/kju/index');

async function test() {
    const urls = [
        'https://www.kjubrasil.com/necessaire-amo-comida-de-praia-farm-etc-inverno-2026/',
        'https://www.kjubrasil.com/necessaire-cacula-xadrez-multicolorido-farm-etc-inverno-2026/',
        'https://www.kjubrasil.com/necessaire-cacula-passarejo-multicolor-off-white-farm-etc-inverno-2026/'
    ];

    console.log('Starting KJU Price Fix Verification...');
    const { browser, page } = await initBrowser();
    page.on('console', msg => console.log('PAGE LOG:', msg.text())); // Capture browser logs

    try {
        for (const url of urls) {
            console.log(`\n-----------------------------------`);
            console.log(`Testing URL: ${url}`);
            const product = await parseProductKJU(page, url);
            console.log('Result:', JSON.stringify(product, null, 2));
        }
    } catch (e) {
        console.error('Error during test:', e);
    } finally {
        await browser.close();
    }
}

test();
