const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { scrapeDressTo } = require('./scrapers/dressto');
const path = require('path');

async function reproduceMany() {
    const { browser, context } = await initBrowser();

    // IDs common in recent failures or typical for Dress To
    const driveItems = [
        { id: '02072689', driveUrl: 'https://example.com/1.jpg', isFavorito: false, store: 'dressto' },
        { id: '01332934', driveUrl: 'https://example.com/2.jpg', isFavorito: false, store: 'dressto' },
        { id: '01332822', driveUrl: 'https://example.com/3.jpg', isFavorito: false, store: 'dressto' }
    ];

    try {
        console.log('\n--- TESTING SPECIFIC IDS ---');
        const idResults = await scrapeSpecificIdsGeneric(context, driveItems, 'dressto', 5);
        console.log('ID Results:', JSON.stringify(idResults.stats, null, 2));

        console.log('\n--- TESTING MAIN LISTING ---');
        const listResults = await scrapeDressTo(5, browser);
        console.log('List Results Count:', listResults.length);

    } catch (err) {
        console.error('Error during reproduction:', err);
    } finally {
        await browser.close();
    }
}

reproduceMany();
