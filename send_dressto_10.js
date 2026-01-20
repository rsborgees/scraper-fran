const { runAllScrapers } = require('./orchestrator');
const { sendToWebhook } = require('./cronScheduler');

async function sendTenDressTo() {
    console.log('🚀 Iniciando coleta de 10 peças Dress To (Drive Priority)...');

    try {
        // Define quota de 10 apenas para dressto
        const products = await runAllScrapers({
            farm: 0,
            dressto: 10,
            kju: 0,
            live: 0,
            zzmall: 0
        });

        if (products.length > 0) {
            console.log(`\n📦 Total coletado: ${products.length} produtos.`);
            console.log('📤 Enviando para o webhook...');

            const result = await sendToWebhook(products);

            if (result.success) {
                console.log('✅ 10 peças enviadas com sucesso!');
            } else {
                console.error('❌ Falha ao enviar para o webhook:', result.error);
            }
        } else {
            console.log('⚠️ Nenhum produto Dress To encontrado (ou todos são duplicados recentes).');
        }

    } catch (error) {
        console.error('❌ Erro crítico no processo:', error.message);
    }
}

sendTenDressTo();
