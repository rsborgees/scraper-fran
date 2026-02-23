const { scrapeFarmSiteNovidades } = require('./scrapers/farm/siteNovidades');
const { buildFarmMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

async function run() {
    console.log('🚀 Buscando 1 novidade inédita (fora do Drive) com PAYLOAD PADRÃO...');
    try {
        const products = await scrapeFarmSiteNovidades(1);

        if (products.length === 0) {
            console.log('❌ Nenhuma novidade encontrada fora do Drive.');
            return;
        }

        const p = products[0];
        console.log(`✅ Novidade encontrada: ${p.nome} (${p.id})`);

        // PADRÃO: O campo da mensagem deve ser 'message', não 'caption'
        p.message = buildFarmMessage(p, p.timerData);

        // Adicionando metadados que o orchestrator costuma ter
        p.isNovidade = true;
        p.isSiteNovidade = true;

        console.log('📤 Enviando via sendToWebhook (Payload Padrão)...');
        // sendToWebhook espera um array de produtos
        const result = await sendToWebhook([p]);

        if (result.success) {
            console.log(`✅ Sucesso! Webhook aceitou o lote.`);
        } else {
            console.log(`❌ Erro no webhook: ${result.error}`);
        }

    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

run();
