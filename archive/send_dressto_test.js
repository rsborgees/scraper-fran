const { runAllScrapers } = require('./orchestrator');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

async function sendDressToWebhook() {
    console.log('🚀 Enviando 2 produtos Dress To para o Webhook...');

    const quotas = {
        farm: 0,
        dressto: 2,
        kju: 0,
        live: 0,
        zzmall: 0
    };

    try {
        const products = await runAllScrapers(quotas);

        if (products.length > 0) {
            console.log(`\n✅ Capturados ${products.length} produtos.`);
            console.log('📤 Enviando para webhook...');
            await sendToWebhook(products);
            console.log('✅ Concluído!');
        } else {
            console.log('\n⚠️ Nenhum produto Dress To encontrado no Drive.');
        }

    } catch (error) {
        console.error('❌ Erro no envio:', error.message);
    }
}

sendDressToWebhook();
