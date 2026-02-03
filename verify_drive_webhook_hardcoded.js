const { buildZzMallMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

(async () => {
    const driveUrl = 'https://drive.google.com/uc?export=download&id=1gbHbcwDPdyJNgaMB4KGg5UaQ5MmCXiP-';
    const storeName = 'zzmall';
    const productId = '1906200310002';

    console.log('🚀 Final Verification: Sending hardcoded product + Direct Drive image to Webhook');

    try {
        const product = {
            id: productId,
            nome: "CHINELO PRETO BRILHO BICO REDONDO",
            precoOriginal: 159.9,
            precoAtual: 79.9,
            url: 'https://www.zzmall.com.br/chinelo-preto-brilho-bico-redondo/p/1906200310002U',
            loja: storeName,
            imagePath: driveUrl,
            imageUrl: driveUrl
        };

        product.message = buildZzMallMessage(product);

        console.log(`📦 Item: ${product.nome}`);
        console.log(`🖼️  Image: ${product.imagePath}`);

        console.log('\n📤 Sending to Webhook...');
        const webhookResult = await sendToWebhook([product]);

        if (webhookResult.success) {
            console.log('\n🎉 Successfully sent to webhook!');
        } else {
            console.error('\n❌ Failed to send to webhook:', webhookResult.error);
        }
    } catch (error) {
        console.error('❌ Error during verification:', error);
    }
})();
