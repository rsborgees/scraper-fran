const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildZzMallMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

(async () => {
    console.log(`🚀 Starting ZZMall Drive Send (5 items)`);

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        console.error('❌ GOOGLE_DRIVE_FOLDER_ID not found in .env');
        process.exit(1);
    }

    const { browser, context } = await initBrowser();

    try {
        console.log('📂 Fetching ZZMall items from Drive...');
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        const zzmallDriveItems = allDriveItems
            .filter(item => item.store === 'zzmall')
            .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
            .slice(0, 10); // Batch of 10 to get 5 successful ones

        if (zzmallDriveItems.length === 0) {
            console.log('❌ No ZZMall items found in Drive.');
            return;
        }

        console.log(`🔍 Scraping ${zzmallDriveItems.length} items (Batch to find 5)...`);
        let { products } = await scrapeSpecificIdsGeneric(context, zzmallDriveItems, 'zzmall', 5);

        // Fallback: If still nothing, try searching by name for items that failed
        if (products.length < 5) {
            console.log('⚠️  Falling back to name-based search for ZZMall...');
            const failedItems = zzmallDriveItems.filter(item => !products.some(p => p.id.includes(item.id)));
            for (const item of failedItems.slice(0, 5)) {
                if (products.length >= 5) break;
                console.log(`🔍 Trying name-based search for: ${item.name}`);
                // Simple search logic for the script
                const searchUrl = `https://www.zzmall.com.br/search/${encodeURIComponent(item.name.replace('.jpg', '').replace('A', '').trim())}`;
                try {
                    const page = await context.newPage();
                    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 45000 });
                    const currentUrl = page.url();
                    if (currentUrl.includes('/p/')) {
                        console.log(`   ✅ Found product via name search: ${currentUrl}`);
                        // We could call the parser here, but for simplicity, 
                        // let's just use the existing scrapeSpecificIdsGeneric logic if we can.
                    }
                    await page.close();
                } catch (e) {
                    console.log(`   ❌ Name search failed: ${e.message}`);
                }
            }
        }

        if (products.length > 0) {
            console.log(`✅ Scraped ${products.length} products.`);
            products.forEach(p => {
                console.log(`   🔸 [${p.id}] ${p.nome} - URL: ${p.url}`);
                p.message = buildZzMallMessage(p);
            });

            if (products.length < 5) {
                console.log(`⚠️  Only ${products.length} products found. Sending anyway.`);
            }

            console.log('📤 Sending to Webhook...');
            const result = await sendToWebhook(products.slice(0, 5));
            console.log('🏁 Result:', result);
        } else {
            console.log('❌ No products scraped. ZZMall search might be failing for these IDs.');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await browser.close();
        console.log('🏁 Finished.');
    }
})();
