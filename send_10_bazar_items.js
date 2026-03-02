const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { sendToWebhook } = require('./cronScheduler');
const { buildMessageForProduct } = require('./messageBuilder');
require('dotenv').config();

async function send10BazarItems() {
    console.log('🚀 Starting "Send 10 Bazar Items" Job...');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        console.error('❌ GOOGLE_DRIVE_FOLDER_ID not found in .env');
        return;
    }

    const { browser, context } = await initBrowser();

    try {
        console.log('📂 Fetching bazar items from Drive...');
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        const bazarItems = allDriveItems.filter(item => item.bazar);

        console.log(`✅ Found ${bazarItems.length} bazar items in Drive.`);

        if (bazarItems.length === 0) {
            console.log('⚠️ No bazar items found to send.');
            return;
        }

        const results = [];
        let currentIndex = 0;

        while (results.length < 10 && currentIndex < bazarItems.length) {
            const batch = bazarItems.slice(currentIndex, currentIndex + 5);
            currentIndex += 5;

            console.log(`🔍 Scraping batch of ${batch.length} items (Total collected: ${results.length})...`);

            const stores = [...new Set(batch.map(item => item.store))];
            for (const store of stores) {
                const storeItems = batch.filter(item => item.store === store);
                let scraped;
                if (store === 'farm') {
                    scraped = await scrapeSpecificIds(context, storeItems, 999, { maxAgeHours: 0 });
                } else {
                    scraped = await scrapeSpecificIdsGeneric(context, storeItems, store, 999, { maxAgeHours: 0 });
                }

                if (scraped.products && scraped.products.length > 0) {
                    scraped.products.forEach(p => {
                        if (results.length < 10) {
                            p.message = buildMessageForProduct(p);
                            p.bazar = true;
                            p.isBazar = true;
                            results.push(p);
                        }
                    });
                }
            }
        }

        console.log(`\n📦 Total collected: ${results.length} products.`);

        if (results.length > 0) {
            console.log('📤 Sending to webhook...');
            const webhookResult = await sendToWebhook(results);
            if (webhookResult.success) {
                console.log('✅ Success! 10 Bazar items sent to webhook.');
            } else {
                console.log('❌ Failed to send to webhook:', webhookResult.error);
            }
        } else {
            console.log('⚠️ No products were successfully scraped.');
        }

    } catch (error) {
        console.error('❌ Error during job:', error);
    } finally {
        await browser.close();
    }
}

send10BazarItems();
