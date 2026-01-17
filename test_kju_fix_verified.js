
const { chromium } = require('playwright');
const path = require('path');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');

(async () => {
    console.log('\n🧪 TESTING KJU FIX...');

    // Mock drive items - USAR ID que sabemos que existe no browser check: 35240410066
    const driveItems = [
        { id: '35240410066', driveUrl: 'http://test/kju_img.jpg', isFavorito: false, store: 'kju' }
    ];

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    try {
        const results = await scrapeSpecificIdsGeneric(browser, driveItems, 'kju', 1);

        console.log('\n📊 RESULTS:');
        console.log(JSON.stringify(results, null, 2));

        if (results.length > 0) {
            console.log('✅ TEST PASSED: Product found via KJU Search!');
        } else {
            console.log('❌ TEST FAILED: Product NOT found.');
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    } finally {
        await browser.close();
    }
})();
