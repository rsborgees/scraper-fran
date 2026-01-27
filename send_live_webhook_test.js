const { scrapeLiveByName } = require('./scrapers/live/nameScanner');
const { initBrowser } = require('./browser_setup');
const { sendToWebhook } = require('./cronScheduler');
const { buildLiveMessage } = require('./messageBuilder');
require('dotenv').config();

(async () => {
    console.log('🚀 [TEST] Iniciando envio de item Live para Webhook...');

    // Item real detectado anteriormente no Drive
    const driveItem = {
        name: "macaquinho shorts fit green",
        id: "LIVE_16Vnoq",
        searchByName: true,
        driveUrl: "https://drive.google.com/uc?export=download&id=16Vnoqru1GXF42LLrILzfd94p6UWLKvF2",
        isFavorito: false,
        store: 'live'
    };

    const { browser, context } = await initBrowser();

    try {
        // 1. Scrape the item
        const products = await scrapeLiveByName(context, [driveItem], 1);

        if (!products || products.length === 0) {
            console.log('❌ Falha ao capturar o produto no site.');
            return;
        }

        const product = products[0];

        // 2. Build the message (Orchestrator logic)
        // Note: buildLiveMessage expects an array
        product.message = buildLiveMessage([product]);

        console.log('\n💬 MENSAGEM GERADA:');
        console.log('--------------------------------------------------');
        console.log(product.message);
        console.log('--------------------------------------------------');

        console.log('\n📦 Detalhes do Produto:');
        console.log(`   Nome:           ${product.nome}`);
        console.log(`   Preço Atual:    ${product.precoAtual}`);
        console.log(`   Preço Original: ${product.precoOriginal}`);
        console.log(`   Grade/Cores:    ${product.cor_tamanhos}`);
        console.log(`   ID:             ${product.id}`);
        console.log(`   Loja:           ${product.loja}`);

        // 3. Send to Webhook
        console.log('\n📤 Enviando para o webhook de produção...');
        const result = await sendToWebhook([product]);

        if (result.success) {
            console.log('\n✅ SUCESSO! O item foi enviado com sucesso.');
        } else {
            console.log(`\n❌ FALHA ao enviar webhook: ${result.error}`);
        }

    } catch (err) {
        console.error('❌ ERRO FATAL:', err);
    } finally {
        await browser.close();
        console.log('\n🏁 Processo finalizado.');
    }
})();
