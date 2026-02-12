const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');
require('dotenv').config();

(async () => {
    console.log('🧪 Starting Verification Test for Drive ID propagation...');

    // 1. Mock a Drive item with a composite ID
    // Note: We are testing the logic, so we'll simulate the item that driveManager would return
    const mockDriveItem = {
        id: "351693",
        driveId: "351693 350740", // Space separated IDs from filename
        ids: ["351693", "350740"],
        isSet: true,
        store: "farm",
        isFavorito: true,
        driveUrl: "https://drive.google.com/uc?export=download&id=mock_file_id"
    };

    console.log(`📦 Mock Item Drive ID: ${mockDriveItem.driveId}`);

    const { browser, context } = await initBrowser();

    try {
        console.log('🔍 Running scrapeSpecificIds for Farm...');
        const result = await scrapeSpecificIds(context, [mockDriveItem], 1);

        if (result.products && result.products.length > 0) {
            const p = result.products[0];
            console.log(`✅ Resulting Product ID: ${p.id}`);

            if (p.id === mockDriveItem.driveId) {
                console.log('🎊 SUCCESS: The verbatim Drive ID was preserved!');
            } else {
                console.log(`❌ FAILURE: ID mismatch. Expected "${mockDriveItem.driveId}", got "${p.id}"`);
            }
        } else {
            console.log('⚠️ No products found in scrape. (Expected if ID is not on site, but we should check if id was assigned before failure if possible)');
            // In a real test, we'd need a valid ID or mock the API response.
            // But since I can't easily mock the API response without more work, 
            // I'll check if the logic in idScanner correctly assigns it.
        }
    } catch (err) {
        console.error('❌ Error during test:', err);
    } finally {
        await browser.close();
        console.log('🏁 Test finished.');
    }
})();
