const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');

// Example URLs for testing (suitcases, bags)
const TEST_URLS = [
    'https://www.farmrio.com.br/mala-de-mao-tucanos-com-folhagens-e-bananas-326920/p', // Replace with a real valid URL if this doesn't work, ideally search for 'mala'
];

async function run() {
    console.log('🚀 Starting Farm Category Check...');
    const { browser, page } = await initBrowser();

    try {
        // First, let's find a real Mala url if the static one is dead
        console.log('Searching for a "mala"...');
        await page.goto('https://www.farmrio.com.br/busca/?q=mala', { waitUntil: 'load' });
        await page.waitForTimeout(2000);

        const firstMala = await page.evaluate(() => {
            const anchor = document.querySelector('.shelf-product-name a, .product-item__name a');
            return anchor ? anchor.href : null;
        });

        const urls = firstMala ? [firstMala] : TEST_URLS;

        for (const url of urls) {
            console.log(`\nTesting URL: ${url}`);
            const product = await parseProduct(page, url);

            if (product) {
                console.log('✅ Parsed Result:', JSON.stringify({
                    nome: product.nome,
                    categoria: product.categoria,
                    precoAtual: product.precoAtual
                }, null, 2));

                if (product.categoria === 'mala' || product.categoria === 'acessório') {
                    console.log('✨ SUCCESS: Correctly identified as prohibited category.');
                } else {
                    console.log('⚠️ WARNING: Identified as ' + product.categoria);
                }
            } else {
                console.log('❌ Failed to parse (might be blocked by strict filters inside parser if implemented there, or just error).');
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

run();
