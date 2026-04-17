const { scrapeFarmSiteNovidades } = require('./scrapers/farm/siteNovidades');
const { sendToWebhook } = require('./cronScheduler');
const { recordSentItems } = require('./dailyStatsManager');
require('dotenv').config();

async function run() {
    console.log('🚀 [FARM] Iniciando envio manual de 10 novidades...');
    try {
        // Busca 10 novidades que ainda não foram enviadas hoje e não estão no Drive
        const products = await scrapeFarmSiteNovidades(10);

        if (products.length === 0) {
            console.log('❌ [FARM] Nenhuma novidade disponível para envio no momento.');
            return;
        }

        console.log(`✅ [FARM] ${products.length} novidades encontradas e preparadas.`);

        console.log('📤 [FARM] Enviando para o webhook principal...');
        const result = await sendToWebhook(products);

        if (result.success) {
            console.log(`✅ [FARM] Sucesso! ${products.length} produtos enviados.`);
            // Registra no dailyStatsManager para manter o contador diário consistente
            recordSentItems(products);
            console.log('📊 [FARM] Estatísticas diárias atualizadas.');
        } else {
            console.log(`❌ [FARM] Erro ao enviar para o webhook: ${result.error}`);
        }

    } catch (err) {
        console.error('❌ [FARM] Erro durante a execução:', err.message);
    }
}

run();
