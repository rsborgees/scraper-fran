const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');
const { sendToWebhook } = require('./cronScheduler');
const { recordSentItems } = require('./dailyStatsManager');
require('dotenv').config();

async function run() {
    console.log('🚀 [FARM-DRIVE] Iniciando busca de 10 novidades no Google Drive (Total: 10 sucessos)...');
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const allItems = await getExistingIdsFromDrive(folderId);
        
        // Filtro: Farm + Novidade
        const farmNovidades = allItems.filter(item => 
            item.store === 'farm' && 
            (item.novidade || item.name.toLowerCase().includes('novidade'))
        );

        if (farmNovidades.length === 0) {
            console.log('❌ [FARM-DRIVE] Nenhuma novidade encontrada no Drive.');
            return;
        }

        // Ordenar por data de criação desc (mais recentes primeiro)
        farmNovidades.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

        const { browser, context } = await initBrowser();
        const collectedProducts = [];
        let currentIndex = 0;

        try {
            while (collectedProducts.length < 10 && currentIndex < farmNovidades.length) {
                const batchSize = Math.min(10 - collectedProducts.length, 5); // Tenta de 5 em 5 para ser eficiente
                const targetBatch = farmNovidades.slice(currentIndex, currentIndex + batchSize);
                
                if (targetBatch.length === 0) break;
                
                console.log(`\n🔍 [FARM-DRIVE] Tentando lote com ${targetBatch.length} itens (Index: ${currentIndex})...`);
                const result = await scrapeSpecificIds(context, targetBatch, batchSize, { maxAgeHours: 0 });
                
                if (result.products && result.products.length > 0) {
                    collectedProducts.push(...result.products);
                }
                
                currentIndex += batchSize;
                console.log(`📊 [FARM-DRIVE] Progresso: ${collectedProducts.length}/10 coletados.`);
            }

            if (collectedProducts.length === 0) {
                console.log('❌ [FARM-DRIVE] Nenhum produto pôde ser coletado após percorrer as novidades disponiveis.');
                return;
            }

            const finalBatch = collectedProducts.slice(0, 10);
            console.log(`✅ [FARM-DRIVE] ${finalBatch.length} produtos prontos para envio.`);

            // Enviar para Webhook
            console.log('📤 [FARM-DRIVE] Enviando para o webhook...');
            const webhookResult = await sendToWebhook(finalBatch);

            if (webhookResult.success) {
                console.log(`✅ [FARM-DRIVE] Sucesso! ${finalBatch.length} produtos enviados.`);
                recordSentItems(finalBatch);
                console.log('📊 [FARM-DRIVE] Estatísticas diárias atualizadas.');
            } else {
                console.log(`❌ [FARM-DRIVE] Erro no webhook: ${webhookResult.error}`);
            }

        } finally {
            await browser.close();
        }

    } catch (err) {
        console.error('❌ [FARM-DRIVE] Erro fatal:', err.message);
    }
}

run();
