const { initBrowser } = require('./browser_setup');
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { buildDressMessage } = require('./messageBuilder');
const axios = require('axios');
require('dotenv').config();

async function run() {
    console.log("🚀 Starting targeted Dress To send...");
    const { browser, context } = await initBrowser();

    try {
        const driveItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID, 'dressto');
        if (driveItems.length === 0) {
            console.log("❌ No Dress To items found in Drive.");
            return;
        }

        const item = { id: '01332748', driveId: '01332748' };
        console.log(`🔍 Using fresh ID: ${item.id}. Scraping...`);

        const { products } = await scrapeSpecificIdsGeneric(context, [item], 'dressto', 1, { maxAgeHours: -1 });

        if (products.length > 0) {
            const p = products[0];
            p.message = buildDressMessage(p);
            console.log("✅ Product scraped and message built:");
            console.log(p.message);

            if (true) {
                const webhookUrl = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
                console.log(`📤 Sending to webhook: ${webhookUrl}`);
                const payload = {
                    timestamp: new Date().toISOString(),
                    totalProducts: 1,
                    products: [p],
                    summary: { dressto: 1 }
                };

                await axios.post(webhookUrl, payload);
                console.log("🚀 Sent!");
            }
        } else {
            console.log("❌ Failed to scrape the item.");
        }
    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        await browser.close();
    }
}

run();
