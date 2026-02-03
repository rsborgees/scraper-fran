const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { buildZzMallMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

(async () => {
    const { browser, context } = await initBrowser();

    // Using the IDs we found in Drive earlier.
    // If the new search logic works, at least one of these might show up or we verify the navigation works.
    const driveItems = [
        { id: '1356900110008', driveUrl: 'https://drive.google.com/uc?export=download&id=17xSeTiH1HDA0AmjqMf75fmrdpdfO7pSm', isFavorito: true, store: 'zzmall' },
        { id: '1364200730002', driveUrl: 'https://drive.google.com/uc?export=download&id=15qCZlYxofA-gv-zpdISfIzWVnk4a4LTK', isFavorito: true, store: 'zzmall' },
        { id: '1017611210022', driveUrl: 'https://drive.google.com/uc?export=download&id=1LQAYd2Fn7maMzy2BXwzOcwC5kdzpSJ-R', isFavorito: true, store: 'zzmall' }
    ];

    console.log('🚀 Verification: Testing new ZZMall Search URL logic (/search/ID)');

    try {
        // This will use the UPDATED idScanner which uses /search/ID
        const result = await scrapeSpecificIdsGeneric(context, driveItems, 'zzmall', 10);

        if (result.products.length > 0) {
            console.log(`\n✅ Found ${result.products.length} products!`);

            for (const product of result.products) {
                console.log(`\n📦 Processing: ${product.nome}`);
                product.message = buildZzMallMessage(product);

                console.log('\n📤 Sending to Webhook...');
                const webhookResult = await sendToWebhook([product]);

                if (webhookResult.success) {
                    console.log('   🎉 Sent successfully!');
                } else {
                    console.error('   ❌ Failed to send:', webhookResult.error);
                }
            }
        } else {
            console.log('\n❌ No products found with the new search URL.');
            console.log('   (This might mean the items are truly out of stock ID-wise, but the search URL logic was put to test)');
        }
    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await browser.close();
    }
})();
