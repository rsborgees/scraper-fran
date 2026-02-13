const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildFarmMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');

async function testDriveSetWebhook() {
    console.log('🧪 Iniciando TESTE DE CONJUNTO DO DRIVE + WEBHOOK...');

    // IDs reais que estão em estoque (Top + Saia Primor De Abacaxi)
    const driveItems = [
        {
            id: '357978',
            ids: ['357978', '357979'],
            isSet: true,
            isFavorito: true,
            store: 'farm',
            driveUrl: 'https://drive.google.com/uc?export=download&id=1_sample_drive_id'
        }
    ];

    const { browser, context } = await initBrowser();

    try {
        const { products } = await scrapeSpecificIds(context, driveItems, 1);

        if (products.length > 0) {
            const product = products[0];
            console.log(`✅ Conjunto capturado: ${product.nome}`);

            // Gera a mensagem usando a nova lógica
            product.message = buildFarmMessage(product);
            console.log('\n--- MENSAGEM GERADA ---');
            console.log(product.message);
            console.log('-----------------------\n');

            // Envia para o webhook
            console.log('🚀 Enviando para o webhook...');
            const webhookResult = await sendToWebhook([product]);

            if (webhookResult && webhookResult.success) {
                console.log('✅ SUCESSO: Payload enviado ao webhook.');
            } else {
                console.log('⚠️  FALHA ou Resposta Inesperada do Webhook.');
            }
        } else {
            console.log('❌ FALHA: Nenhum produto foi capturado. Verifique se os IDs são válidos ou se há estoque.');
        }
    } catch (err) {
        console.error('❌ Erro durante o teste:', err.stack);
    } finally {
        await browser.close();
        console.log('🔓 Navegador fechado.');
    }
}

testDriveSetWebhook();
