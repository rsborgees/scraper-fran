const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');

async function run() {
    const { browser, context } = await initBrowser();
    try {
        const driveItems = [
            { id: '357261', bazar: true, isFavorito: false } // Sample product from Farm
        ];
        
        console.log('--- TEST BAZAR 10% OFF ---');
        const result = await scrapeSpecificIds(context, driveItems, 1);
        console.log('\nFINAL OUTPUT:', JSON.stringify(result.products, null, 2));
    } finally {
        await browser.close();
    }
}
run();
