const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { sendToWebhook } = require('./cronScheduler');
const { buildMessageForProduct } = require('./messageBuilder');
require('dotenv').config();

async function send7MoreBazarItems() {
    console.log('🚀 Starting "Send 7 More Bazar Items" Job...');
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

        if (bazarItems.length <= 10) {
            console.log('⚠️ Not enough new bazar items to send (already sent or tried first 10).');
            // Fallback: just send whatever is available if they really want 7
            // But let's assume there are more.
        }

        const targetItems = bazarItems.slice(10, 17);
        if (targetItems.length === 0) {
            console.log('⚠️ No more bazar items found in the next slice.');
            return;
        }

        console.log(`🎯 Selected ${targetItems.length} items (offset 10) to scrape and send.`);

        const results = [];
        const stores = [...new Set(targetItems.map(item => item.store))];

        for (const store of stores) {
            const storeItems = targetItems.filter(item => item.store === store);
            console.log(`🔍 Scraping ${storeItems.length} items from ${store.toUpperCase()}...`);

            let scraped;
            if (store === 'farm') {
                scraped = await scrapeSpecificIds(context, storeItems, 999, { maxAgeHours: 0 });
            } else {
                scraped = await scrapeSpecificIdsGeneric(context, storeItems, store, 999, { maxAgeHours: 0 });
            }

            if (scraped.products && scraped.products.length > 0) {
                scraped.products.forEach(p => {
                    p.message = buildMessageForProduct(p);
                    p.bazar = true;
                    p.isBazar = true;
                    results.push(p);
                });
            }
        }

        console.log(`\n📦 Total collected: ${results.length} products.`);

        if (results.length > 0) {
            console.log('📤 Sending to webhook...');
            const webhookResult = await sendToWebhook(results);
            if (webhookResult.success) {
                console.log(`✅ Success! ${results.length} Bazar items sent to webhook.`);
            } else {
                console.log('❌ Failed to send to webhook:', webhookResult.error);
            }
        } else {
            console.log('⚠️ No products were successfully scraped in this batch.');
        }

    } catch (error) {
        console.error('❌ Error during job:', error);
    } finally {
        await browser.close();
    }
}

send7MoreBazarItems();
