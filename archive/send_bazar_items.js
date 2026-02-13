const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildFarmMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

(async () => {
    const bazarItems = [
        {
            "id": "350624",
            "driveId": "350624",
            "ids": ["350624"],
            "isSet": false,
            "store": "farm",
            "isFavorito": false,
            "novidade": false,
            "bazar": true,
            "driveUrl": "https://drive.google.com/uc?export=download&id=1TiFIhjFaAVTXgghSlwN6Jq8SubbuVVJ0"
        },
        {
            "id": "354118_8238",
            "driveId": "354118_8238",
            "ids": ["354118_8238"],
            "isSet": false,
            "store": "farm",
            "isFavorito": false,
            "novidade": false,
            "bazar": true,
            "driveUrl": "https://drive.google.com/uc?export=download&id=16anbjAuGtF94BPBbm3y3086RhRbY3fTd"
        }
    ];

    console.log(`🚀 Starting Bazar Send Test (${bazarItems.length} items)`);
    const { browser, context } = await initBrowser();

    try {
        console.log('🔍 Scraping items...');
        // Note: Farm idScanner normally blocks Bazar, but scrapeSpecificIds ignores some filters if it's "Specific"
        // However, looking at farm/idScanner.js:93, it might still block Bazar.
        // Let's check farm/idScanner.js again or use a override if possible.
        // Actually, fastParseFromApi (line 234) blocks bazar. 
        // I might need to bypass that for this specific request.

        const { products } = await scrapeSpecificIds(context, bazarItems, 2);

        if (products.length > 0) {
            console.log(`✅ Scraped ${products.length} products.`);
            products.forEach(p => {
                p.message = buildFarmMessage(p, p.timerData);
            });

            console.log('📤 Sending to Webhook...');
            const result = await sendToWebhook(products);
            console.log('🏁 Result:', result);
        } else {
            console.log('❌ No products scraped. (Baza items might be blocked by the scanner filter)');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await browser.close();
        console.log('🏁 Finished.');
    }
})();
