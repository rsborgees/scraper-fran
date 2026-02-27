const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildMessageForProduct } = require('./messageBuilder');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

async function send3KjuFromDrive() {
    console.log('🚀 Searching for Kju items in Drive...');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
        console.error('❌ Missing GOOGLE_DRIVE_FOLDER_ID in .env');
        return;
    }

    const driveItems = await getExistingIdsFromDrive(folderId);
    const kjuItems = driveItems.filter(item => item.store === 'kju');

    console.log(`📊 Found ${kjuItems.length} Kju items in Drive.`);

    if (kjuItems.length === 0) {
        console.error('❌ No Kju items found in Drive.');
        return;
    }

    // Shuffle and pick 3
    const shuffled = kjuItems.sort(() => 0.5 - Math.random());
    const top3 = shuffled.slice(0, 3);
    console.log(`🔍 Scraping 3 random items: ${top3.map(i => i.id).join(', ')}`);

    const { browser, context } = await initBrowser();
    try {
        const { products } = await scrapeSpecificIdsGeneric(context, top3, 'kju', 3);

        console.log(`✅ Scraped ${products.length} products.`);

        if (products.length > 0) {
            console.log(`📤 Sending ${products.length} products to webhook...`);

            const payload = {
                timestamp: new Date().toISOString(),
                totalProducts: products.length,
                products: products.map(p => ({
                    ...p,
                    message: buildMessageForProduct(p)
                }))
            };

            try {
                await axios.post(WEBHOOK_URL, payload);
                console.log(`   ✅ Sent successfully!`);
            } catch (err) {
                console.error(`   ❌ Failed to send: ${err.message}`);
                if (err.response) console.log(err.response.data);
            }
        }
    } finally {
        await browser.close();
    }
}

send3KjuFromDrive();
