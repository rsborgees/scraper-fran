
const { chromium } = require('playwright');
const path = require('path');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');

(async () => {
    console.log('\n🧪 TESTING DRESSTO FIX WITH DIRECT URL...');

    // Mock drive items
    const driveItems = [
        { id: '01332499', driveUrl: 'http://test/img.jpg', isFavorito: false, store: 'dressto' }
    ];

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    try {
        const results = await scrapeSpecificIdsGeneric(browser, driveItems, 'dressto', 1);

        console.log('\n📊 RESULTS:');
        console.log(JSON.stringify(results, null, 2));

        if (results.length > 0) {
            console.log('✅ TEST PASSED: Product found via Direct URL/Search!');
        } else {
            console.log('❌ TEST FAILED: Product NOT found.');
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    } finally {
        await browser.close();
    }
})();
