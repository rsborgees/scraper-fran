const { scrapeLiveByName } = require('./scrapers/live/nameScanner');
const { initBrowser } = require('./browser_setup');
const { sendToWebhook } = require('./cronScheduler');
const { buildLiveMessage } = require('./messageBuilder');
require('dotenv').config();

(async () => {
    console.log('🚀 [LIVE SEND] Enviando as duas peças verificadas para o Webhook...');

    // Itens que funcionaram no teste anterior
    const driveItems = [
        {
            name: "top live! hydefit® adaptiv",
            id: "LIVE_1e-9Q3",
            searchByName: true,
            driveUrl: "https://drive.google.com/uc?export=download&id=1e-9Q3f7zNJoWF70Ru4yi7r7aZc_S5GVg",
            store: 'live'
        },
        {
            name: "macaquinho shorts fit green",
            id: "LIVE_16Vnoq",
            searchByName: true,
            driveUrl: "https://drive.google.com/uc?export=download&id=16Vnoqru1GXF42LLrILzfd94p6UWLKvF2",
            store: 'live'
        }
    ];

    const { browser, context } = await initBrowser();

    try {
        console.log(`🚙 Capturando detalhes atualizados para ${driveItems.length} itens...`);
        const results = await scrapeLiveByName(context, driveItems, 2);

        if (results.length === 0) {
            console.log('❌ Nenhum item capturado. Nada para enviar.');
            return;
        }

        console.log(`✅ ${results.length} itens capturados. Gerando mensagens e enviando...`);

        // Preparar cada produto para o webhook
        results.forEach(p => {
            // buildLiveMessage espera um array
            p.message = buildLiveMessage([p]);
        });

        // Enviar para o webhook
        const sendResult = await sendToWebhook(results);

        if (sendResult.success) {
            console.log('\n✅ SUCESSO! Itens enviados ao webhook de produção.');
        } else {
            console.log(`\n❌ FALHA ao enviar webhook: ${sendResult.error}`);
        }

    } catch (err) {
        console.error('❌ Erro fatal:', err.message);
    } finally {
        await browser.close();
        console.log('\n🏁 Processo finalizado.');
    }
})();
