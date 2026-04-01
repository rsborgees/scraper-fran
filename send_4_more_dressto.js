const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { getExistingIdsFromDrive } = require('./driveManager');
const { buildDressMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
const { loadHistory, normalizeId } = require('./historyManager');
require('dotenv').config();

async function send4MoreDressToWebhook() {
    console.log('🚀 Starting: Sending 4 more Dress To items to webhook...');

    const { browser, context } = await initBrowser();

    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        console.log('📂 Loading Dress To items from Drive...');
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        
        const history = loadHistory();

        // Filter and sort by priority (unsent first)
        const dresstoItems = allDriveItems
            .filter(i => i.store === 'dressto')
            .sort((a, b) => {
                const aSent = history[normalizeId(a.id)] ? 1 : 0;
                const bSent = history[normalizeId(b.id)] ? 1 : 0;
                if (aSent !== bSent) return aSent - bSent;
                return new Date(b.createdTime) - new Date(a.createdTime);
            });

        const targetItems = dresstoItems.slice(0, 30); // Pool
        console.log(`🔍 Scrapping 4 more items...`);

        const results = await scrapeSpecificIdsGeneric(context, targetItems, 'dressto', 4, { maxAgeHours: 1 });

        if (results.products && results.products.length > 0) {
            console.log(`✅ Successfully scraped ${results.products.length} products.`);

            results.products.forEach(p => {
                p.message = buildDressMessage(p);
            });

            console.log('📤 Sending to webhook...');
            const webhookResult = await sendToWebhook(results.products);

            if (webhookResult.success) {
                console.log('\n🎉 SUCCESS! Products sent to webhook.');
                const { markAsSent } = require('./historyManager');
                const { recordSentItems } = require('./dailyStatsManager');
                markAsSent(results.products.map(p => p.id));
                recordSentItems(results.products);
            } else {
                console.error('\n❌ Error sending to webhook:', webhookResult.error);
            }
        } else {
            console.log('\n❌ No products were scraped successfully.');
        }

    } catch (err) {
        console.error('\n❌ Unexpected error in script:', err);
    } finally {
        await browser.close();
        console.log('🔒 Browser closed.');
    }
}

send4MoreDressToWebhook();
