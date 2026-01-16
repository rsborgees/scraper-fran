const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');

async function testPhase1() {
    console.log('🚀 Testing Live Drive Integration (Phase 1)...');
    const { browser, context } = await initBrowser();

    // Mock Item from Drive (as provided by driveManager)
    const mockItems = [
        {
            id: 'LIVE_TEST_123',
            name: 'Macaquinho shorts fit Green', // The item verified to exist
            driveUrl: 'https://mock.drive/image.jpg',
            isFavorito: true,
            store: 'live',
            searchByName: true
        }
    ];

    try {
        console.log('🚙 Calling scrapeSpecificIdsGeneric with Live mock item...');
        // Correct parameter order: (contextOrBrowser, driveItems, storeName, quota)
        const products = await scrapeSpecificIdsGeneric(context, mockItems, 'live', 5);

        console.log('✅ Final Result (Phase 1):', JSON.stringify(products, null, 2));

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
}

testPhase1();
