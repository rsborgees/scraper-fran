const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { runAllScrapers } = require('./orchestrator');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');


const { getPromoSummary } = require('./scrapers/farm/promoScanner');

// Webhook Configuration
const WEBHOOK_URL = 'https://n8n-francalheira.vlusgm.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const DAILY_WEBHOOK_URL = "https://n8n-francalheira.vlusgm.easypanel.host/webhook/922595b8-a675-4e9e-8493-f3e734f236af";
const DRIVE_SYNC_WEBHOOK_URL = "https://n8n-francalheira.vlusgm.easypanel.host/webhook/fav-fran";

/**
 * Envia o resumo diário de promoções (Job das 09h)
 */
async function runDailyPromoJob() {
    console.log('\n' + '='.repeat(60));
    console.log(`🌞 DAILY PROMO JOB INICIADO - ${new Date().toLocaleString('pt-BR')}`);
    console.log('='.repeat(60) + '\n');

    try {
        console.log('📝 Gerando copy de promoções...');
        const copy = await getPromoSummary();

        if (!copy || copy.includes('Erro')) {
            throw new Error('Falha ao gerar copy');
        }

        console.log('✅ Copy gerada. Enviando para Webhook específico...');

        const payload = {
            message: copy,
            type: 'daily_summary',
            timestamp: new Date().toISOString()
        };

        await axios.post(DAILY_WEBHOOK_URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('✅ Daily Promo enviado com sucesso!');

    } catch (error) {
        console.error('❌ Erro no Daily Promo Job:', error.message);
        // Opcional: Notificar erro no webhook principal
    }
}

/**
 * Job das 05h: Envia favoritos e novidades do Google Drive
 * Regra: Até 50 produtos, rotação determinística (não repetir até percorrer todos)
 */
async function runDailyDriveSyncJob() {
    console.log('\n' + '='.repeat(60));
    console.log(`📂 DRIVE SYNC JOB INICIADO (05:00) - ${new Date().toLocaleString('pt-BR')}`);
    console.log('='.repeat(60) + '\n');

    try {
        const { getExistingIdsFromDrive } = require('./driveManager');
        const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
        const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
        const { initBrowser } = require('./browser_setup');
        const { buildFarmMessage, buildDressMessage, buildKjuMessage, buildLiveMessage, buildZzMallMessage, buildMessageForProduct } = require('./messageBuilder');
        const { loadHistory, normalizeId } = require('./historyManager');

        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID não configurado');

        // 1. Buscar itens do Drive e Histórico
        console.log('📂 Coletando itens do Google Drive e Histórico...');
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        const history = loadHistory();

        // 2. Seleção de Candidatos (Favoritos ou Novidades) - EXCLUI BAZAR (apenas horários)
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
            // Se nunca enviado, timestamp = 0 (total prioridade)
            item._lastSent = historyEntry ? historyEntry.timestamp : 0;
        });

        // Ordenação ascendente por timestamp (0 vem primeiro)
        // Secundária: Favoritos primeiro se houver empate de data (ou seja, ambos nunca enviados)
        candidates.sort((a, b) => {
            if (a._lastSent !== b._lastSent) return a._lastSent - b._lastSent;
            if (a.isFavorito && !b.isFavorito) return -1;
            if (!a.isFavorito && b.isFavorito) return 1;
            return 0;
        });

        // 4. Limite de 50 produtos
        const targetItems = candidates.slice(0, 50);
        console.log(`🎯 Selecionados ${targetItems.length} itens para rotação hoje (Priorizando inéditos/antigos).`);

        // 5. Inicializar navegador
        const { browser, context } = await initBrowser();
        const results = [];

        try {
            // Agrupar por loja para processamento
            const stores = [...new Set(targetItems.map(item => item.store))];

            for (const store of stores) {
                const storeItems = targetItems.filter(item => item.store === store);
                console.log(`\n🔍 Processando ${storeItems.length} itens da ${store.toUpperCase()}...`);

                let scraped;
                if (store === 'farm') {
                    // maxAgeHours: 0 para permitir repetição de itens já enviados em dias anteriores se necessário para atingir a meta
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

            console.log(`\n📦 Total coletado para o Job das 05h: ${results.length} produtos.`);

            if (results.length > 0) {
                // 6. Enviar para Webhook
                const payload = {
                    timestamp: new Date().toISOString(),
                    totalProducts: results.length,
                    products: results,
                    summary: {
                        sent: results.length,
                        totalCandidates: candidates.length,
                        novidades: results.filter(p => p.novidade || p.isNovidade).length,
                        favoritos: results.filter(p => p.favorito || p.isFavorito).length,
                        stores: stores.reduce((acc, store) => {
                            acc[store] = results.filter(p => p.loja === store).length;
                            return acc;
                        }, {})
                    },
                    type: 'daily_drive_sync'
                };

                await axios.post(DRIVE_SYNC_WEBHOOK_URL, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                });

                console.log('✅ Drive Sync Job enviado com sucesso para o webhook!');
            }

        } finally {
            await browser.close();
        }

    } catch (error) {
        console.error('❌ Erro no Drive Sync Job:', error.message);
    }
}

/**
 * Envia os dados coletados para o webhook com retry automático
 * @param {Array} products - Lista de produtos coletados
 * @param {number} retries - Número de tentativas restantes
 */
async function sendToWebhook(products, retries = 3) {
    try {
        const { buildMessageForProduct } = require('./messageBuilder');

        console.log(`\n📤 Enviando ${products.length} produtos para webhook...`);

        // Garantir que todos os produtos tenham o campo 'message'
        products.forEach(p => {
            if (!p.message) {
                console.log(`   🔸 Gerando mensagem faltante para: ${p.nome} (${p.loja || p.brand})`);
                p.message = buildMessageForProduct(p);
            }
        });

        // Formata os dados no formato esperado
        const payload = {
            timestamp: new Date().toISOString(),
            totalProducts: products.length,
            products: products,
            summary: {
                farm: products.filter(p => p.loja === 'farm').length,
                dressto: products.filter(p => p.loja === 'dressto').length,
                kju: products.filter(p => p.loja === 'kju').length,
                live: products.filter(p => p.loja === 'live').length,
                zzmall: products.filter(p => p.loja === 'zzmall').length
            }
        };

        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 segundos
        });

        console.log('✅ Dados enviados com sucesso para webhook!');
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);

        return { success: true, response: response.data };
    } catch (error) {
        const isNetworkError = error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';

        if (isNetworkError && retries > 0) {
            const waitTime = (4 - retries) * 2000; // 2s, 4s, 6s
            console.warn(`⚠️  Erro de rede: ${error.message}`);
            console.log(`   🔄 Tentando novamente em ${waitTime / 1000}s... (${retries} tentativas restantes)`);

            await new Promise(resolve => setTimeout(resolve, waitTime));
            return sendToWebhook(products, retries - 1);
        }

        console.error('❌ Erro ao enviar para webhook:', error.message);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data)}`);
        }
        return { success: false, error: error.message };
    }
}



/**
 * Executa o scraper completo e envia para webhook
 */
async function runScheduledScraping() {


    console.log('\n' + '='.repeat(60));
    console.log(`⏰ SCRAPING AGENDADO INICIADO - ${new Date().toLocaleString('pt-BR')}`);
    console.log('='.repeat(60) + '\n');

    try {
        // 1. Executa todos os scrapers
        const allProducts = await runAllScrapers();

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESULTADO DO SCRAPING');
        console.log('='.repeat(60));
        console.log(`Total de produtos coletados: ${allProducts.length}\n`);

        // 2. Envia para webhook
        const webhookResult = await sendToWebhook(allProducts);

        console.log('\n' + '='.repeat(60));
        console.log('✅ SCRAPING AGENDADO CONCLUÍDO');
        console.log('='.repeat(60) + '\n');

        return { products: allProducts, webhook: webhookResult };
    } catch (error) {
        console.error('\n❌ Erro no scraping agendado:', error);

        // Tenta enviar notificação de erro para webhook
        try {
            await axios.post(WEBHOOK_URL, {
                error: true,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        } catch (webhookError) {
            console.error('❌ Erro ao notificar webhook sobre falha:', webhookError.message);
        }

        throw error;
    }
}

/**
 * Configura o agendamento diário
 */
function setupDailySchedule() {
    console.log('\n🕐 Configurando agendamentos...');
    const timezone = "America/Sao_Paulo";

    // 1. Scraping Horário: De 1h em 1h, das 7h às 21h (Horário de Brasília)
    const scrapingCron = '0 7-21 * * *';
    console.log(`   📅 Scraping: ${scrapingCron} (Horário)`);

    cron.schedule(scrapingCron, async () => {
        await runScheduledScraping();
    }, { timezone });

    // 2. Daily Promo Job: Todo dia às 08:00
    const promoCron = '0 8 * * *';
    console.log(`   📅 Daily Promo: ${promoCron} (08:00)`);

    cron.schedule(promoCron, async () => {
        await runDailyPromoJob();
    }, { timezone });

    // 3. Reloginho Check: De 1h em 1h, 24/7
    const reloginhoCron = '0 * * * *';
    cron.schedule(reloginhoCron, async () => {
        await checkFarmTimer();
    }, { timezone });

    // 4. Drive Sync Job: Todo dia às 05:00
    const driveSyncCron = '0 5 * * *';
    console.log(`   📅 Drive Sync: ${driveSyncCron} (05:00)`);

    cron.schedule(driveSyncCron, async () => {
        await runDailyDriveSyncJob();
    }, { timezone });

    console.log('✅ Cron Jobs Iniciados! (Timezone: São Paulo)\n');

}

/**
 * Calcula o horário da próxima execução
 */
function getNextRunTime() {
    const now = new Date();
    const next = new Date(now);

    // Se estamos fora do intervalo (antes das 7h ou depois das 21h), agenda para as 7h de hoje ou amanhã
    const currentHour = now.getHours();

    if (currentHour >= 21) {
        // Já passou das 21h, próximo é amanhã às 7h
        next.setDate(next.getDate() + 1);
        next.setHours(7, 0, 0, 0);
    } else if (currentHour < 7) {
        // Antes das 7h, próximo é hoje às 7h
        next.setHours(7, 0, 0, 0);
    } else {
        // Dentro do intervalo, próximo é na próxima hora cheia
        next.setHours(currentHour + 1, 0, 0, 0);
    }

    return next.toLocaleString('pt-BR');
}

/**
 * Executa teste manual (útil para verificação)
 */
async function runManualTest() {
    console.log('\n🧪 MODO DE TESTE MANUAL\n');
    await runScheduledScraping();
}

// Exporta funções
module.exports = {
    setupDailySchedule,
    runScheduledScraping,
    runDailyDriveSyncJob,
    runManualTest,
    sendToWebhook
};

// Se executado diretamente, inicia o agendador
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--test')) {
        // Modo teste: executa imediatamente
        runManualTest().then(() => {
            console.log('\n✅ Teste concluído. Encerrando...');
            process.exit(0);
        }).catch(error => {
            console.error('\n❌ Teste falhou:', error);
            process.exit(1);
        });
    } else {
        // Modo normal: inicia agendador
        setupDailySchedule();

        console.log('🚀 Sistema de agendamento ativo!');
        console.log('   Pressione Ctrl+C para encerrar\n');

        // Mantém o processo rodando
        process.on('SIGINT', () => {
            console.log('\n\n👋 Encerrando agendador...');
            process.exit(0);
        });
    }
}
