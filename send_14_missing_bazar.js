const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { sendToWebhook } = require('./cronScheduler');
const { buildMessageForProduct } = require('./messageBuilder');
const { loadHistory, normalizeId } = require('./historyManager');
require('dotenv').config();

async function send14BazarItems() {
    console.log('🚀 Starting "Send 14 Bazar Items" Job...');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        console.error('❌ GOOGLE_DRIVE_FOLDER_ID not found in .env');
        return;
    }

    const { browser, context } = await initBrowser();

    try {
        console.log('📂 Fetching bazar items from Drive...');
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        
        // Ordenar pelo histórico para pegar os menos enviados recentemente (ou nunca enviados)
        const history = loadHistory();
        const getPriorityScore = (item) => {
            const normId = normalizeId(item.driveId || item.id);
            const entry = history[normId];
            if (!entry) return 1000; // never sent
            const daysSinceLastSent = (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24);
            return daysSinceLastSent;
        };

        const bazarItems = allDriveItems
            .filter(item => item.bazar || item.isBazar)
            .sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

        console.log(`✅ Found ${bazarItems.length} bazar items in Drive.`);

        if (bazarItems.length === 0) {
            console.log('⚠️ No bazar items found to send.');
            return;
        }

        const results = [];
        let currentIndex = 0;

        while (results.length < 14 && currentIndex < bazarItems.length) {
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

                if (scraped && scraped.products && scraped.products.length > 0) {
                    scraped.products.forEach(p => {
                        if (results.length < 14) {
                            p.message = buildMessageForProduct(p);
                            p.bazar = true;
                            p.isBazar = true;
                            // Injecting [BAZAR] in the name for N8N Webhook routing removed
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
            if (webhookResult && webhookResult.success) {
                console.log('✅ Success! 14 Bazar items sent to webhook.');
            } else {
                console.log('❌ Failed to send to webhook:', webhookResult ? webhookResult.error : 'Unknown error');
            }
        } else {
            console.log('⚠️ No products were successfully scraped.');
        }

    } catch (error) {
        console.error('❌ Error during job:', error);
    } finally {
        if (browser) await browser.close();
    }
}

send14BazarItems();
