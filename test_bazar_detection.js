const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');

async function test() {
    const { browser, context } = await initBrowser();
    const page = await context.newPage();

    // Test cases: [URL, expectedBazar]
    const testCases = [
        ['https://www.farmrio.com.br/vestido-curto-estampa-floral-em-floresta/p', false],
        ['https://www.farmrio.com.br/macacao-pantacourt-linho-estampa-borboleta/p', false],
        ['https://www.farmrio.com.br/bazar/vestido-curto-estampa-floral/p', true] // Example bazar
    ];

    for (const [url, expected] of testCases) {
        console.log(`\nTesting: ${url}`);
        const product = await parseProduct(page, url);
        if (product) {
            console.log(`Result Bazar: ${product.bazar} (Expected: ${expected})`);
            if (product.bazar !== expected) {
                console.log(`❌ ERROR: Mismatch for URL ${url}`);
            } else {
                console.log(`✅ OK`);
            }
        } else {
            console.log(`❌ Product not found or error.`);
        }
    }

    await browser.close();
}

test();
