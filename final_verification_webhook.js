const { scrapeZZMall } = require('./scrapers/zzmall/index');
const { closeBrowser } = require('./browser_setup');
const { processImageDirect } = require('./imageDownloader');
const { sendToWebhook } = require('./cronScheduler');
const { buildZzMallMessage } = require('./messageBuilder');
require('dotenv').config();

(async () => {
    console.log('🚀 Final Verification: Getting a real ZZMall product and testing Drive image redirect');
    try {
        // 1. Get a real available product
        const products = await scrapeZZMall(1);

        if (products && products.length > 0) {
            const product = products[0];
            console.log(`\n✅ Product caught: ${product.nome}`);

            // 2. Override image with a redirecting Drive URL (The core fix test)
            const driveUrl = 'https://drive.google.com/uc?export=download&id=1gbHbcwDPdyJNgaMB4KGg5UaQ5MmCXiP-';
            console.log(`   🖼️  Processing Drive image (Redirect test): ${driveUrl}`);

            const imgResult = await processImageDirect(driveUrl, 'ZZMALL', product.id);

            if (imgResult.status === 'success' && imgResult.cloudinary_urls?.length > 0) {
                product.imagePath = imgResult.cloudinary_urls[0];
                product.imageUrl = imgResult.cloudinary_urls[0];
                console.log(`   ✅ Image processed and uploaded: ${product.imagePath}`);
            } else {
                console.log(`   ⚠️  Image processing failed, using raw: ${imgResult.reason}`);
                product.imagePath = driveUrl;
            }

            product.message = buildZzMallMessage(product);

            console.log('\n📤 Sending to Webhook...');
            const webhookResult = await sendToWebhook([product]);

            if (webhookResult.success) {
                console.log('\n🎉 Successfully sent to webhook!');
            } else {
                console.error('\n❌ Failed to send to webhook:', webhookResult.error);
            }

        } else {
            console.log('\n❌ Failed to catch any product.');
        }
    } catch (error) {
        console.error('❌ Error during verification:', error);
    }

    process.exit(0);
})();
