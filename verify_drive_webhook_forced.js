const { initBrowser } = require('./browser_setup');
const { parseProductZZMall } = require('./scrapers/zzmall');
const { buildZzMallMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
const { processImageDirect } = require('./imageDownloader');
require('dotenv').config();

(async () => {
    const { browser, page } = await initBrowser();

    const directUrl = 'https://www.zzmall.com.br/chinelo-preto-brilho-bico-redondo/p/1906200310002U';
    const driveUrl = 'https://drive.google.com/uc?export=download&id=1gbHbcwDPdyJNgaMB4KGg5UaQ5MmCXiP-';
    const storeName = 'zzmall';
    const productId = '1906200310002';

    console.log('🚀 Final Verification: Sending direct URL + Drive image to Webhook');

    try {
        console.log(`🧐 Parsing: ${directUrl}`);
        const product = await parseProductZZMall(page, directUrl);

        if (product) {
            console.log(`   ✅ Matched: ${product.nome}`);

            // 🖼️ Use Direct Drive Image (As requested by user)
            console.log(`   🖼️  Using direct Drive link: ${driveUrl}`);
            product.imagePath = driveUrl;
            product.imageUrl = driveUrl;

            product.loja = storeName;
            product.id = productId;
            product.message = buildZzMallMessage(product);

            console.log('\n📤 Sending to Webhook...');
            const webhookResult = await sendToWebhook([product]);

            if (webhookResult.success) {
                console.log('\n🎉 Successfully sent to webhook!');
            } else {
                console.error('\n❌ Failed to send to webhook:', webhookResult.error);
            }
        } else {
            console.log('\n❌ Failed to parse product.');
        }
    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await browser.close();
    }
})();
