const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabaseClient');
const { recordSentItems } = require('./dailyStatsManager');

// Arquivo de flag para rastrear a última execução do Drive Sync Job
const DRIVE_SYNC_FLAG_FILE = path.join(__dirname, 'data', 'last_drive_sync.json');

/**
 * Retorna a data de hoje no fuso de Brasília (YYYY-MM-DD)
 * Independente da configuração de locale do servidor.
 */
function getTodayBRTISO() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const [{ value: day }, , { value: month }, , { value: year }] = formatter.formatToParts(now);
    return `${year}-${month}-${day}`;
}

/**
 * Retorna a data de hoje no formato do banco (DD/MM/YYYY)
 */
function getTodayBRTString() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const [{ value: day }, , { value: month }, , { value: year }] = formatter.formatToParts(now);
    return `${day}/${month}/${year}`;
}

function getLastDriveSyncDate() {
    try {
        if (!fs.existsSync(DRIVE_SYNC_FLAG_FILE)) return null;
        const data = JSON.parse(fs.readFileSync(DRIVE_SYNC_FLAG_FILE, 'utf8'));
        return data.lastRunDate || null; // Format: 'YYYY-MM-DD'
    } catch (e) {
        return null;
    }
}

function markDriveSyncRan() {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const today = getTodayBRTISO();
        fs.writeFileSync(DRIVE_SYNC_FLAG_FILE, JSON.stringify({ 
            lastRunDate: today, 
            lastRunTime: new Date().toISOString() 
        }, null, 2));
        console.log(`✅ [Flag] Drive Sync marcado como executado hoje: ${today}`);
    } catch (e) {
        console.error('⚠️  Erro ao marcar Drive Sync como executado:', e.message);
    }
}


// We'll require orchestrator later to avoid circular dependencies during initialization
let orchestrator = null;
function getOrchestrator() {
    if (!orchestrator) orchestrator = require('./orchestrator');
    return orchestrator;
}
const { checkFarmTimer } = require('./scrapers/farm/timer_check');


const { getPromoSummary } = require('./scrapers/farm/promoScanner');

// Webhook Configuration
const WEBHOOK_URL = 'https://n8n-francalheira.vlusgm.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const DAILY_WEBHOOK_URL = "https://n8n-francalheira.vlusgm.easypanel.host/webhook/922595b8-a675-4e9e-8493-f3e734f236af";
const DRIVE_SYNC_WEBHOOK_URL = "https://n8n-francalheira.vlusgm.easypanel.host/webhook/fav-fran";

/**
 * Busca estatísticas detalhadas da tabela 'produtos' no Supabase
 */
async function getSupabaseStats() {
    try {
        const today = getTodayBRTString();
        console.log(`🔍 [Stats] Buscando produtos enviados em: ${today} (filtros por 'hora_entrada')`);

        const { data, error } = await supabase
            .from('produtos')
            .select('loja, bazar, favorito, novidade, hora_entrada')
            .like('hora_entrada', `${today}%`); // Filtra apenas itens de HOJE

        if (error) throw error;

        const stats = {
            total: data.length,
            stores: { farm: 0, dressto: 0, live: 0, kju: 0, zzmall: 0 },
            bazar: 0
        };

        data.forEach(item => {
            const store = (item.loja || '').toLowerCase();
            const storeKey = (store === 'dress' || store === 'dressto') ? 'dressto' : store;
            if (stats.stores[storeKey] !== undefined) {
                stats.stores[storeKey]++;
            }
            // Verifica bazar
            if (item.bazar || item.bazarFavorito) {
                stats.bazar++;
            }
        });

        return stats;
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas no Supabase:', error.message);
        return { total: 0, stores: { farm: 0, dressto: 0, live: 0, kju: 0, zzmall: 0 }, bazar: 0 };
    }
}

/**
 * Calcula as quotas dinâmicas baseadas no estado atual do banco
 */
function calculateDynamicQuotas(currentStats) {
    const GLOBAL_TARGET = 160;
    const IDEAL_TARGETS = {
        farm: Math.round(GLOBAL_TARGET * 0.70),    // 116
        dressto: Math.round(GLOBAL_TARGET * 0.15), // 25
        live: Math.round(GLOBAL_TARGET * 0.08),    // 13
        kju: Math.round(GLOBAL_TARGET * 0.05),     // 8
        zzmall: Math.round(GLOBAL_TARGET * 0.02)   // 3
    };

    console.log(`\n📊 [DynamicBalancing] Estado atual (Bank/Supabase) vs Meta (165):`);
    const needed = {};
    let totalNeeded = 0;

    Object.keys(IDEAL_TARGETS).forEach(store => {
        const current = currentStats.stores[store] || 0;
        const target = IDEAL_TARGETS[store];
        const diff = Math.max(0, target - current);
        needed[store] = diff;
        totalNeeded += diff;
        console.log(`   🔸 ${store.toUpperCase().padEnd(7)}: ${String(current).padStart(3)} / ${target} (Falta: ${diff})`);
    });

    const SESSION_CAPACITY = 11;
    const sessionQuotas = {};

    if (totalNeeded === 0) {
        console.log('✅ [DynamicBalancing] Meta diária global atingida.');
        return { farm: 0, dressto: 0, kju: 0, live: 0, zzmall: 0 };
    }

    if (totalNeeded <= SESSION_CAPACITY) {
        Object.assign(sessionQuotas, needed);
    } else {
        // Distribui a capacidade da sessão (11) priorizando quem tem o MAIOR GAP PERCENTUAL
        // Isso garante que lojas menores que estão longe da meta (ex: Dress 10/25) 
        // sejam priorizadas sobre Farm que já está quase lá (ex: 110/116).
        const priorityScore = (store) => {
            const current = currentStats.stores[store] || 0;
            const target = IDEAL_TARGETS[store];
            if (target === 0) return 0;
            return (target - current) / target; // Gap percentual (0.0 a 1.0)
        };

        const sortedByGap = Object.keys(needed)
            .filter(s => needed[s] > 0)
            .sort((a, b) => priorityScore(b) - priorityScore(a));

        let distributed = 0;

        // 1ª passada: Garante presença das lojas com maior gap
        for (const store of sortedByGap) {
            if (distributed < SESSION_CAPACITY) {
                sessionQuotas[store] = (sessionQuotas[store] || 0) + 1;
                distributed++;
            }
        }

        // 2ª passada: Preenche o resto da sessão mantendo a prioridade
        let idx = 0;
        while (distributed < SESSION_CAPACITY) {
            const store = sortedByGap[idx % sortedByGap.length];
            if (sessionQuotas[store] < needed[store]) {
                sessionQuotas[store]++;
                distributed++;
            }
            idx++;
            if (idx > 100) break; // Safety
        }
    }

    // Garantir que todas as chaves existam
    ['farm', 'dressto', 'kju', 'live', 'zzmall'].forEach(s => {
        if (sessionQuotas[s] === undefined) sessionQuotas[s] = 0;
    });

    console.log(`🎯 [DynamicBalancing] Meta sugerida para esta execução: `, sessionQuotas);
    return {
        sessionQuotas, remaining: {
            total: totalNeeded,
            stores: needed
        }
    };
}


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
        // NOTA: Para o Job de 5 AM, ignoramos o estado do banco conforme solicitado pelo usuário.
        // O banco deve estar vazio nesse horário, permitindo o envio completo dos 50 itens.
        console.log(`📊 [DriveSync] Iniciando processamento direto sem verificação de limite.`);

        const { getExistingIdsFromDrive } = require('./driveManager');
        const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
        const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
        const { initBrowser } = require('./browser_setup');
        const { buildMessageForProduct } = require('./messageBuilder');
        const { loadHistory, normalizeId, markAsSent } = require('./historyManager');

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
            // Ainda assim marcamos como executado para não ficar tentando em loop no catch-up se o drive estiver vazio
            markDriveSyncRan();
            return;
        }

        // Marcar como executado agora que sabemos que há trabalho a fazer
        markDriveSyncRan();

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

        // 4. Inicializar navegador e resultados
        const { browser, context } = await initBrowser();
        const results = [];
        const TARGET_GOAL = 50;
        let candidatesOffset = 0;

        try {
            while (results.length < TARGET_GOAL && candidatesOffset < candidates.length) {
                const remainingNeeded = TARGET_GOAL - results.length;
                // Pegamos um lote maior (ex: 2x o necessário) para compensar itens sem estoque
                const batchSize = Math.max(remainingNeeded * 2, 20); 
                const currentBatch = candidates.slice(candidatesOffset, candidatesOffset + batchSize);
                candidatesOffset += batchSize;

                if (currentBatch.length === 0) break;

                console.log(`\n🔍 [Tentativa] Buscando mais ${remainingNeeded} itens (Analisando lote de ${currentBatch.length})...`);

                // Agrupar lote por loja
                const stores = [...new Set(currentBatch.map(item => item.store))];
                for (const store of stores) {
                    if (results.length >= TARGET_GOAL) break;

                    const storeItems = currentBatch.filter(item => item.store === store);
                    console.log(`   - ${store.toUpperCase()}: ${storeItems.length} itens no lote.`);

                    let scraped;
                    if (store === 'farm') {
                        scraped = await scrapeSpecificIds(context, storeItems, TARGET_GOAL - results.length, { maxAgeHours: 0 });
                    } else {
                        scraped = await scrapeSpecificIdsGeneric(context, storeItems, store, TARGET_GOAL - results.length, { maxAgeHours: 0 });
                    }

                    if (scraped.products && scraped.products.length > 0) {
                        scraped.products.forEach(p => {
                            if (!p.message) p.message = buildMessageForProduct(p);
                            results.push(p);
                        });
                    }
                }

                console.log(`📊 Progresso: ${results.length}/${TARGET_GOAL} itens coletados.`);
            }

            console.log(`\n📦 Total final coletado para o Job das 05h: ${results.length} produtos.`);

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
                        stores: results.reduce((acc, p) => {
                            const loja = p.loja || 'unknown';
                            acc[loja] = (acc[loja] || 0) + 1;
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

                // 7. Marcar como enviados e registrar estatísticas
                const allIds = results.map(p => p.id);
                markAsSent(allIds);
                recordSentItems(results);
                console.log(`✅ [DriveSync] ${results.length} itens marcados como enviados no histórico.`);


            }

        } finally {
            if (browser) await browser.close();
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
        // 0. Verificar limite e calcular quotas inteligentes (Filtrado por HOJE)
        const currentStats = await getSupabaseStats();
        console.log(`📊 [LimitCheck] Itens enviados hoje: ${currentStats.total}/160`);

        if (currentStats.total >= 160) {
            console.log('⚠️ [LimitCheck] Meta diária de 160 peças atingida. Scraping cancelado.');
            return { products: [], webhook: { success: false, reason: 'limit_reached' } };
        }

        const { sessionQuotas, remaining } = calculateDynamicQuotas(currentStats);

        // 1. Executa todos os scrapers com quotas dinâmicas
        const { runAllScrapers } = getOrchestrator();
        const allProducts = await runAllScrapers(sessionQuotas, remaining);

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

    // 🔁 CATCH-UP: Se o processo reiniciou depois das 05h e o job ainda não rodou hoje, executa agora
    const todayBRT = getTodayBRTISO();
    const lastRunDate = getLastDriveSyncDate();

    // Calcula hora atual em Brasília para o Catch-Up
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        hour: 'numeric',
        hour12: false
    });
    const currentHourBRT = parseInt(formatter.format(now));

    console.log(`🕒 [SchedulerCheck] Agora: ${currentHourBRT}h BRT | Hoje: ${todayBRT} | Último Sync: ${lastRunDate}`);

    if (currentHourBRT >= 5 && lastRunDate !== todayBRT) {
        console.log(`⚡ [CatchUp] Drive Sync não rodou hoje (${todayBRT}). Agendando execução imediata...`);
        // Pequeno delay para o servidor terminar de inicializar
        setTimeout(() => runDailyDriveSyncJob().catch(e => console.error('❌ [CatchUp] Erro:', e.message)), 5000);
    } else if (lastRunDate === todayBRT) {
        console.log(`✅ [CatchUp] Drive Sync já executou hoje (${lastRunDate}). Nada a fazer.`);
    } else {
        console.log(`⏲️ [CatchUp] Aguardando horário das 05h para Drive Sync.`);
    }

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
    sendToWebhook,
    getSupabaseStats,
    getTodayBRTISO,
    getTodayBRTString
};

// 2. Self-execution logic
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
