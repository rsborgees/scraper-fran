const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const path = require('path');

async function verify() {
    const { browser, context } = await initBrowser();

    // IDs common in recent failures or requested by user
    const driveItems = [
        { id: '01342724', driveUrl: 'https://example.com/notfound.jpg', isFavorito: false, store: 'dressto' },
        { id: '02072689', driveUrl: 'https://example.com/found.jpg', isFavorito: false, store: 'dressto' },
        { id: '02072699', driveUrl: 'https://example.com/userfail.jpg', isFavorito: false, store: 'dressto' }
    ];

    try {
        console.log('\n--- VERIFYING ROBUST LOGIC ---');
        const results = await scrapeSpecificIdsGeneric(context, driveItems, 'dressto', 10);
        console.log('Results:', JSON.stringify(results.stats, null, 2));

        results.products.forEach(p => {
            console.log(`✅ Found: ${p.nome} (${p.id})`);
        });

    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await browser.close();
    }
}

verify();
