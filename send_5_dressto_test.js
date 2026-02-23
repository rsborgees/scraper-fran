const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { getExistingIdsFromDrive } = require('./driveManager');
const { buildDressMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

async function send5DressToTest() {
    console.log('🚀 Starting test: Sending 5 Dress To items to webhook...');

    // 1. Initialize browser
    const { browser, context } = await initBrowser();

    try {
        // 2. Load candidates from Drive
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        console.log('📂 Loading Dress To items from Drive...');
        const allDriveItems = await getExistingIdsFromDrive(folderId);

        // Pick 5 regular items (or favorites if needed, user just said "5 roupas")
        const dresstoItems = allDriveItems
            .filter(i => i.store === 'dressto')
            .slice(0, 5);

        if (dresstoItems.length < 5) {
            console.log(`⚠️ Only found ${dresstoItems.length} items in Drive.`);
        }

        console.log(`🔍 Scrapping ${dresstoItems.length} items with API-First strategy...`);

        // 3. Scrape items
        // We use a small maxAgeHours to bypass recent history for this specific test
        const results = await scrapeSpecificIdsGeneric(context, dresstoItems, 'dressto', 5, { maxAgeHours: 0.01 });

        if (results.products && results.products.length > 0) {
            console.log(`✅ Successfully scraped ${results.products.length} products.`);

            // 4. Build messages
            results.products.forEach(p => {
                p.message = buildDressMessage(p);
            });

            // 5. Send to webhook
            console.log('📤 Sending to webhook...');
            const webhookResult = await sendToWebhook(results.products);

            if (webhookResult.success) {
                console.log('\n🎉 TEST SUCCESSFUL! 5 items sent to webhook.');
            } else {
                console.error('\n❌ Error sending to webhook:', webhookResult.error);
            }
        } else {
            console.log('\n❌ No products were scraped successfully.');
        }

    } catch (err) {
        console.error('\n❌ Unexpected error in test script:', err);
    } finally {
        await browser.close();
        console.log('🔒 Browser closed.');
    }
}

send5DressToTest();
