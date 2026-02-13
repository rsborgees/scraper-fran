const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { buildZzMallMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

(async () => {
    const { browser, context } = await initBrowser();

    // Real Recent Drive Item
    const driveItems = [
        {
            id: '1017611210022',
            driveUrl: 'https://drive.google.com/uc?export=download&id=1LQAYd2Fn7maMzy2BXwzOcwC5kdzpSJ-R',
            isFavorito: true,
            store: 'zzmall'
        }
    ];

    console.log('🚀 Final Verification: Sending current Drive item to Webhook');
    console.log('📦 Item ID: 1017611210022');

    try {
        const result = await scrapeSpecificIdsGeneric(context, driveItems, 'zzmall', 1);

        if (result.products.length > 0) {
            const product = result.products[0];
            product.message = buildZzMallMessage(product);

            console.log('\n✅ Product scraped successfully!');
            console.log(`🖼️ Final ImagePath: ${product.imagePath}`);

            console.log('\n📤 Sending to Webhook...');
            const webhookResult = await sendToWebhook([product]);

            if (webhookResult.success) {
                console.log('\n🎉 Successfully sent to webhook!');
            } else {
                console.error('\n❌ Failed to send to webhook:', webhookResult.error);
            }
        } else {
            console.log('\n❌ Product not found on site or failed to parse.');
        }
    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await browser.close();
    }
})();
