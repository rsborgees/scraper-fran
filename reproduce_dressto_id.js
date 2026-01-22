const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const path = require('path');

async function reproduce() {
    const { browser, context } = await initBrowser();
    const driveItems = [
        { id: '02072689', driveUrl: 'https://example.com/image.jpg', isFavorito: false, store: 'dressto' }
    ];

    try {
        const result = await scrapeSpecificIdsGeneric(context, driveItems, 'dressto', 1);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Error during reproduction:', err);
    } finally {
        await browser.close();
    }
}

reproduce();
