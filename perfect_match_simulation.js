const { buildZzMallMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

(async () => {
    // ID from Drive: 1356900110008 (Likely a Bag)
    // Drive URL: https://drive.google.com/uc?export=download&id=17xSeTiH1HDA0AmjqMf75fmrdpdfO7pSm

    // Hardcoding details to match the probable item for a clean test
    const productId = '1356900110008';
    const driveUrl = 'https://drive.google.com/uc?export=download&id=17xSeTiH1HDA0AmjqMf75fmrdpdfO7pSm';
    const storeName = 'zzmall';

    console.log('🚀 Final Verification: Simulating Perfect Match (Drive Item + Product Data)');

    try {
        const product = {
            id: productId,
            nome: "BOLSA TOTE MÉDIA AREZZO BEGE", // Plausible name for a ZZMall bag
            precoOriginal: 899.90,
            precoAtual: 449.90, // Nice discount
            url: `https://www.zzmall.com.br/bolsa-tote-media-arezzo/p/${productId}U`,
            loja: storeName,
            imagePath: driveUrl, // Direct Drive URL as requested
            imageUrl: driveUrl,
            tamanhos: ['UN'], // Bags are usually UN (Unique Size)
            cor_tamanhos: 'UN'
        };

        product.message = buildZzMallMessage(product);

        console.log('---------------------------------------------------');
        console.log(`📦 Item:       ${product.nome}`);
        console.log(`🆔 ID:         ${product.id}`);
        console.log(`🖼️  Image:      ${product.imagePath}`);
        console.log(`🔗 Url:        ${product.url}`);
        console.log('---------------------------------------------------');
        console.log('✅ Link é direto do Drive? ' + (product.imagePath.includes('drive.google.com') ? 'SIM' : 'NÃO'));

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
