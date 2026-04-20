
const axios = require('axios');
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildMessageForProduct } = require('./messageBuilder');
const { loadHistory, normalizeId, markAsSent } = require('./historyManager');
require('dotenv').config();

// Webhook URL updated to the correct host
const DRIVE_SYNC_WEBHOOK_URL = "https://n8n-francalheira.vlusgm.easypanel.host/webhook/fav-fran";

async function sendSpecificItems(limit = 10) {
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 MANUAL JOB: ENVIANDO ${limit} FAVORITOS/NOVIDADES - ${new Date().toLocaleString('pt-BR')}`);
    console.log('='.repeat(60) + '\n');

    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID não configurado');

        // 1. Buscar itens do Drive e Histórico
        console.log('📂 Coletando itens do Google Drive e Histórico...');
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        const history = loadHistory();

        // 2. Seleção de Candidatos (Favoritos ou Novidades) - EXCLUI BAZAR
        let candidates = allDriveItems.filter(item => (item.isFavorito || item.novidade) && !item.bazar);
        console.log(`✅ Encontrados ${candidates.length} candidatos (Favoritos ou Novidades) no Drive.`);

        if (candidates.length === 0) {
            console.log('ℹ️ Nenhum favorito ou novidade encontrado para enviar.');
            return;
        }

        // 3. Ordenação para Rotação (Inéditos primeiro, depois os mais antigos)
        candidates.forEach(item => {
            const normId = normalizeId(item.driveId || item.id);
            const historyEntry = history[normId];
            item._lastSent = historyEntry ? historyEntry.timestamp : 0;
        });

        candidates.sort((a, b) => {
            if (a._lastSent !== b._lastSent) return a._lastSent - b._lastSent;
            if (a.isFavorito && !b.isFavorito) return -1;
            if (!a.isFavorito && b.isFavorito) return 1;
            return 0;
        });

        // 4. Limite solicitado (Pegamos mais para garantir o sucesso após scraping, já que muitos esgotam)
        const targetItems = candidates.slice(0, Math.max(50, limit * 3));
        console.log(`🎯 Selecionados ${targetItems.length} candidatos para tentar chegar em ${limit} sucessos.`);

        // 5. Inicializar navegador
        const { browser, context } = await initBrowser();
        const results = [];

        try {
            const stores = [...new Set(targetItems.map(item => item.store))];

            for (const store of stores) {
                const storeItems = targetItems.filter(item => item.store === store);
                console.log(`\n🔍 Processando ${storeItems.length} itens da ${store.toUpperCase()}...`);

                let scraped;
                if (store === 'farm') {
                    scraped = await scrapeSpecificIds(context, storeItems, 999, { maxAgeHours: 0 });
                } else {
                    scraped = await scrapeSpecificIdsGeneric(context, storeItems, store, 999, { maxAgeHours: 0 });
                }

                if (scraped.products && scraped.products.length > 0) {
                    scraped.products.forEach(p => {
                        if (!p.message) {
                            p.message = buildMessageForProduct(p);
                        }
                        results.push(p);
                    });
                }
            }

            console.log(`\n📦 Total coletado para envio: ${results.length} produtos.`);

            if (results.length > 0) {
                // Slice para exatamente o limite solicitado se tiver mais
                const finalResults = results.slice(0, limit);

                // 6. Enviar para Webhook
                const payload = {
                    timestamp: new Date().toISOString(),
                    totalProducts: finalResults.length,
                    products: finalResults,
                    summary: {
                        sent: finalResults.length,
                        totalCandidates: candidates.length,
                        novidades: finalResults.filter(p => p.novidade || p.isNovidade).length,
                        favoritos: finalResults.filter(p => p.favorito || p.isFavorito).length,
                        stores: [...new Set(finalResults.map(p => p.loja))].reduce((acc, store) => {
                            acc[store] = finalResults.filter(p => p.loja === store).length;
                            return acc;
                        }, {})
                    },
                    type: 'daily_drive_sync'
                };

                console.log('📤 Enviando para Webhook:', DRIVE_SYNC_WEBHOOK_URL);
                const response = await axios.post(DRIVE_SYNC_WEBHOOK_URL, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                });

                console.log(`✅ Webhook enviado com sucesso! Status: ${response.status}`);

                // 7. Atualizar Histórico para evitar repetição
                console.log('📝 Atualizando histórico...');
                const sentIds = finalResults.map(p => p.id || p.driveId);
                markAsSent(sentIds);
                console.log(`✅ ${sentIds.length} itens marcados como enviados.`);
            } else {
                console.log('⚠️ Nenhum item foi coletado com sucesso após o scraping.');
            }

        } finally {
            await browser.close();
        }

    } catch (error) {
        console.error('❌ Erro no envio manual:', error.message);
        if (error.response) {
            console.error('   Response data:', error.response.data);
        }
    }
}

sendSpecificItems(10);
