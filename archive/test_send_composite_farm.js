const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { buildFarmMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

(async () => {
    const { browser, context } = await initBrowser();

    // Composite ID item from Drive (identified in previous debug)
    const driveItems = [
        {
            id: '359120_07645',
            driveUrl: 'https://drive.google.com/uc?export=download&id=1XzY_your_actual_id_placeholder', // The scraper will actually use the URL from the site, driveUrl is for the source
            isFavorito: false,
            novidade: true,
            store: 'farm'
        }
    ];

    console.log('🚀 Webhook Verification: Sending Farm Composite ID item');
    console.log('📦 ID: 359120_07645');

    try {
        // Scrape item
        const result = await scrapeSpecificIds(context, driveItems, 1);

        if (result.products.length > 0) {
            const product = result.products[0];

            // Verificação do ID antes de enviar
            console.log(`\n🔍 ID capturado pelo scraper: ${product.id}`);

            product.message = buildFarmMessage(product, product.timerData);

            console.log('\n📤 Enviando para o Webhook...');
            const webhookResult = await sendToWebhook([product]);

            if (webhookResult.success) {
                console.log('\n🎉 Enviado com sucesso! Verifique o canal do Telegram/Webhook.');
            } else {
                console.error('\n❌ Falha ao enviar:', webhookResult.error);
            }
        } else {
            console.log('\n❌ Produto não encontrado no site ou falha no parse.');
        }
    } catch (error) {
        console.error('❌ Erro durante verificação:', error);
    } finally {
        await browser.close();
    }
})();
