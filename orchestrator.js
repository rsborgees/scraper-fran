/**
 * Orchestrator - Coordena todos os scrapers de lojas
 * Total: 17 produtos
 * Distribuição: FARM 12, Dress To 1, KJU 1, Live 2, ZZMall 1
 */

const fs = require('fs');
const path = require('path');

const { initBrowser } = require('./browser_setup'); // Necessário para passar browser instancia
const { distributeLinks } = require('./distributionEngine');

// Imports
const { scrapeFarm } = require('./scrapers/farm');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner'); // NOVO
const { getExistingIdsFromDrive } = require('./driveManager');
const { isDuplicate, normalizeId, loadHistory } = require('./historyManager'); // IMPORTADO PARA FILTRO PREVIO
const {
    buildKjuMessage,
    buildDressMessage,
    buildLiveMessage,
    buildFarmMessage,
    buildZzMallMessage
} = require('./messageBuilder');
const { scrapeFarmSiteNovidades } = require('./scrapers/farm/siteNovidades');


/**
 * Calcula o score de prioridade de um item
 * 1- Cobertura Semanal (não enviado há 7 dias): +5000
 * 2- Modificações Recentes (< 7 dias): +2000
 * 3- Novidades (High: 1000+)
 * 4- Favoritos (Medium-High: 500+)
 * 5- Outros (Low)
 */
function getPriorityScore(item, history = {}) {
    let score = 0;
    const now = Date.now();
    const normId = normalizeId(item.id);

    // 1. Weekly Coverage (Absolute Priority: everything in Drive must be sent during the week)
    if (history[normId]) {
        const lastSentMs = history[normId].timestamp;
        const daysSinceLastSent = (now - lastSentMs) / (1000 * 60 * 60 * 24);
        if (daysSinceLastSent >= 7) score += 5000;
    } else {
        // Se nunca foi enviado, também é prioridade de cobertura semanal
        score += 5000;
    }

    // 2. Recent Modifications (Priority: most recent modifications in the last 7 days)
    if (item.createdTime) {
        const createdDate = new Date(item.createdTime);
        const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 7) score += 2000;
    }

    // 3. Novidades do Drive ou identificadas no site
    if (item.novidade || item.isNovidade) score += 1000;

    // 4. Favoritos do Drive
    if (item.isFavorito || item.favorito) score += 500;

    return score;
}

async function runAllScrapers(overrideQuotas = null) {
    const allProducts = [];
    const quotas = overrideQuotas || {
        farm: 6,     // 50% (Aprox)
        dressto: 2,  // 17%
        kju: 1,      // 8%
        live: 2,     // 17%
        zzmall: 1    // 8%
    };

    // 🚀 SINGLE BROWSER INSTANCE SHARING
    // Inicializa o navegador uma única vez para todos os scrapers
    const { browser, context } = await initBrowser();

    try {
        const calculatedTotalTarget = Object.values(quotas).reduce((a, b) => a + b, 0);
        console.log(`🚀 ORCHESTRATOR: Meta ${calculatedTotalTarget} Itens [F:${quotas.farm} D:${quotas.dressto} K:${quotas.kju} L:${quotas.live} Z:${quotas.zzmall}]`);

        // =================================================================
        // PHASE 1: GOOGLE DRIVE PRIORITY
        // =================================================================
        const history = loadHistory();
        const driveProducts = [];
        let driveItemsByStore = { farm: [], dressto: [], kju: [], zzmall: [], live: [] };
        let allUnusedDriveItems = [];

        try {
            if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
                const allDriveItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);

                // Separar itens por loja
                allDriveItems.forEach(item => {
                    if (item.store && driveItemsByStore[item.store]) {
                        driveItemsByStore[item.store].push(item);
                    }
                });

                console.log(`📊 [Drive] Distribuição por loja:`);
                Object.entries(driveItemsByStore).forEach(([store, items]) => {
                    if (items.length > 0) console.log(`   ${store.toUpperCase()}: ${items.length} itens`);
                });

                // FARM Drive Items (único scraper de ID implementado por enquanto)
                const uniqueFarmItems = new Map();

                driveItemsByStore.farm.forEach(item => {
                    const normId = normalizeId(item.id);
                    // Se já existe, damos preferência se o novo for favorito
                    if (uniqueFarmItems.has(normId)) {
                        const existing = uniqueFarmItems.get(normId);
                        if (!existing.isFavorito && item.isFavorito) {
                            uniqueFarmItems.set(normId, item);
                        }
                    } else {
                        uniqueFarmItems.set(normId, item);
                    }
                });

                const farmDriveItems = Array.from(uniqueFarmItems.values()).filter(item => {
                    if (item.isFavorito) return true;
                    // Farm Drive: 48h (2 dias)
                    return !isDuplicate(normalizeId(item.id), { force: item.isFavorito, maxAgeHours: 48 }, item.preco);
                });

                if (farmDriveItems.length > 0) {
                    // Ordenar pela nova regra de prioridade
                    const sortedFarmDriveItems = farmDriveItems
                        .sort((a, b) => getPriorityScore(b, history) - getPriorityScore(a, history));

                    console.log(`📊 [FARM] ${sortedFarmDriveItems.length} itens disponíveis no Drive (${farmDriveItems.filter(i => i.novidade).length} novidades, ${farmDriveItems.filter(i => i.isFavorito).length} favoritos)`);

                    // O scraper interno vai respeitar a quota da FARM
                    const farmQuota = quotas.farm;

                    // Reutiliza o browser instanciado
                    // UPDATE: Agora retorna objeto com stats
                    const { products: scrapedDriveItems, attemptedIds, stats } = await scrapeSpecificIds(context, sortedFarmDriveItems, farmQuota);

                    scrapedDriveItems.forEach(p => p.message = buildFarmMessage(p, p.timerData));

                    allProducts.push(...scrapedDriveItems);
                    driveProducts.push(...scrapedDriveItems);

                    // TRACK UNUSED
                    const pickedIds = new Set(scrapedDriveItems.map(p => normalizeId(p.id)));
                    const storeUnused = farmDriveItems.filter(item => !pickedIds.has(normalizeId(item.id)));
                    allUnusedDriveItems.push(...storeUnused);

                    console.log(`📊 [FARM] Stats Drive: ${stats.found} capturados, ${stats.notFound} não encontrados, ${stats.duplicates} duplicados, ${stats.errors} erros.`);
                }

                // =================================================================
                // 🚗 DRIVE-FIRST FOR OTHER STORES (Dressto, KJU, ZZMall, Live)
                // =================================================================
                const otherStores = ['kju', 'zzmall', 'live'];
                const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');

                for (const store of otherStores) {
                    // REMOVIDO isDuplicate PREVIO: O scraper interno vai lidar para mostrar o log de tentativa
                    const items = driveItemsByStore[store];

                    if (items.length > 0) {
                        const limitedItems = items
                            .sort((a, b) => getPriorityScore(b, history) - getPriorityScore(a, history))
                            .slice(0, 50);

                        console.log(`🔍 [${store.toUpperCase()}] Iniciando Drive-First (${items.length} itens)...`);
                        const { products: scrapedItems, stats } = await scrapeSpecificIdsGeneric(context, limitedItems, store, quotas[store]);

                        // Apply message builder
                        scrapedItems.forEach(p => {
                            if (store === 'dressto') p.message = buildDressMessage(p);
                            else if (store === 'kju') p.message = buildKjuMessage(p);
                            else if (store === 'live') p.message = buildLiveMessage([p]); // Live expects array
                            else if (store === 'zzmall') p.message = buildZzMallMessage(p);

                            // Ensure flags are present in final payload
                            p.novidade = p.novidade || p.isNovidade || false;
                            p.isNovidade = p.novidade;
                            p.favorito = p.favorito || p.isFavorito || false;
                            p.isFavorito = p.favorito;
                            p.bazar = p.bazar || false;
                            p.bazarFavorito = p.bazarFavorito || (p.bazar && p.favorito) || false;
                        });

                        allProducts.push(...scrapedItems);
                        driveProducts.push(...scrapedItems);

                        // TRACK UNUSED FOR OTHER STORES
                        const pickedIds = new Set(scrapedItems.map(p => normalizeId(p.id)));
                        const storeUnused = items.filter(item => !pickedIds.has(normalizeId(item.id)));
                        allUnusedDriveItems.push(...storeUnused);

                        console.log(`📊 [${store.toUpperCase()}] Stats Drive: ${stats.found} capturados, ${stats.notFound} não disponiveis, ${stats.duplicates} duplicados.`);
                    }
                }

                // ------------------------------------------------------------------------
                // 👗 [DRESS TO] DRIVE-FIRST (With 2-Pass Repetition Rule)
                // ------------------------------------------------------------------------
                const dressItems = driveItemsByStore['dressto'];
                if (dressItems && dressItems.length > 0) {
                    console.log(`🔍 [DRESSTO] Iniciando Drive-First (${dressItems.length} itens)...`);

                    // Passo 1: Sem repetição recente (72h default, 24h para favoritos)
                    let candidates = dressItems.filter(item => {
                        return !isDuplicate(item.id, { force: !!item.isFavorito, maxAgeHours: 72 });
                    });

                    // Passo 2: Fallback se pool for pequeno (Aceita repetição de 24h para qualquer um)
                    // Consideramos "pool pequeno" se tivermos menos candidatos que a cota da Dress To
                    if (candidates.length < quotas.dressto) {
                        console.log(`   ⚠️ [DRESSTO] Poucos itens novos no Drive. Aplicando fallback de repetição (24h)...`);
                        const fallbackCandidates = dressItems.filter(item => {
                            const normId = normalizeId(item.id);
                            if (candidates.some(c => normalizeId(c.id) === normId)) return false;
                            return !isDuplicate(item.id, { force: true, maxAgeHours: 24 });
                        });
                        candidates = [...candidates, ...fallbackCandidates];
                    }

                    const limitedItems = candidates
                        .sort((a, b) => getPriorityScore(b, history) - getPriorityScore(a, history))
                        .slice(0, 50);

                    const { products: scrapedItems, stats } = await scrapeSpecificIdsGeneric(context, limitedItems, 'dressto', quotas.dressto, { maxAgeHours: 24 }); // Permite fallback de 24h

                    scrapedItems.forEach(p => {
                        p.message = buildDressMessage(p);
                        p.novidade = !!(p.novidade || p.isNovidade);
                        p.isNovidade = p.novidade;
                        p.favorito = !!(p.favorito || p.isFavorito);
                        p.isFavorito = p.favorito;
                        p.bazar = !!p.bazar;
                        p.bazarFavorito = !!(p.bazarFavorito || (p.bazar && p.favorito));
                    });

                    allProducts.push(...scrapedItems);
                    driveProducts.push(...scrapedItems);

                    const pickedIds = new Set(scrapedItems.map(p => normalizeId(p.id)));
                    const storeUnused = dressItems.filter(item => !pickedIds.has(normalizeId(item.id)));
                    allUnusedDriveItems.push(...storeUnused);

                    console.log(`📊 [DRESSTO] Stats Drive: ${stats.found} capturados, ${stats.notFound} não disponiveis, ${stats.duplicates} duplicados.`);
                }
            }
        } catch (driveErr) {
            console.error('❌ Erro Phase 1 (Drive):', driveErr.message);
        }

        // Ajusta Quotas restantes
        const driveCountFarm = driveProducts.filter(p => p.loja === 'farm').length;
        const remainingQuotaFarm = Math.max(0, quotas.farm - driveCountFarm);

        console.log(`📊 Pós-Drive: ${driveCountFarm} itens Farm capturados. Restam ${remainingQuotaFarm} para scraping regular.`);
        console.log(`📊 Itens não utilizados do Drive (Total): ${allUnusedDriveItems.length}`);

        // =================================================================
        // PHASE 2: REGULAR SCRAPING
        // =================================================================

        // 1. Scrapes (Passando o objeto browser)
        // IMPORTANTE: Só faz scraping regular se NÃO houver mais itens no Drive
        // UPDATE: Para FARM e DressTo, NUNCA faz scraping regular (Forbidden)
        const DRIVE_ONLY_STORES = ['farm', 'dressto'];

        if (!DRIVE_ONLY_STORES.includes('farm') && remainingQuotaFarm > 0 && !allUnusedDriveItems.some(i => i.store === 'farm')) {
            console.log(`🌐 [FARM] Drive esgotado. Iniciando scraping regular...`);
            try {
                let products = await scrapeFarm(remainingQuotaFarm, false, context);
                products.forEach(p => p.message = buildFarmMessage(p, p.timerData));
                allProducts.push(...products);
                console.log(`✅ FARM (Regular): ${products.length} msgs geradas`);
            } catch (e) { console.error(`❌ FARM Error: ${e.message}`); }
        } else if (remainingQuotaFarm > 0 && allUnusedDriveItems.some(i => i.store === 'farm')) {
            console.log(`⏭️ [FARM] Pulando scraping regular. Ainda há itens no Drive para redistribuição.`);
        }

        // --- NOVIDADES DO SITE (10% Rule) ---
        const farmSiteQuota = 1;
        console.log(`🌐 [FARM] Buscando Novidades do Site (Meta: ${farmSiteQuota})...`);
        try {
            let products = await scrapeFarmSiteNovidades(farmSiteQuota);
            products.forEach(p => {
                p.message = buildFarmMessage(p, p.timerData);
                p.isSiteNovidade = true;
            });
            allProducts.push(...products);
        } catch (e) { console.error(`❌ [FARM] Novidades Site Error: ${e.message}`); }

        const remainingQuotaDressTo = Math.max(0, quotas.dressto - allProducts.filter(p => p.loja === 'dressto').length);

        // Aba de Novidades do Site (Removido para Dress To ser Drive-Only)
        /*
        const dressSiteQuota = Math.round(quotas.dressto * 0.10) || 2;
        console.log(`🌐 [DRESSTO] Buscando Novidades do Site (Meta: ${dressSiteQuota})...`);
        try {
            const { scrapeDressTo } = require('./scrapers/dressto');
            let products = await scrapeDressTo(dressSiteQuota, context);
            products.forEach(p => {
                p.message = buildDressMessage(p);
                p.isSiteNovidade = true; // Necessário para o motor de distribution
            });
            allProducts.push(...products);
            console.log(`✅ [DRESSTO] Novidades Site: ${products.length} msgs geradas`);
        } catch (e) { console.error(`❌ [DRESSTO] Novidades Site Error: ${e.message}`); }
        */

        if (remainingQuotaDressTo > 0 && !DRIVE_ONLY_STORES.includes('dressto')) {
            // Este bloco agora é legado, pois Dress To é Drive-First + Site Novidades
            console.log(`⏭️ [DRESSTO] Skipping regular scraping fallback.`);
        } else if (quotas.dressto > 0) {
            console.log(`✅ [DRESSTO] Processamento concluído.`);
        }

        const driveCountKju = driveProducts.filter(p => p.loja === 'kju').length;
        const remainingQuotaKju = Math.max(0, quotas.kju - driveCountKju);

        if (remainingQuotaKju > 0) {
            try {
                const { scrapeKJU } = require('./scrapers/kju');
                let products = await scrapeKJU(remainingQuotaKju, context);
                products.forEach(p => p.message = buildKjuMessage(p));
                allProducts.push(...products);
                console.log(`✅ KJU: ${products.length} msgs geradas`);
            } catch (e) { console.error(`❌ KJU Error: ${e.message}`); }
        } else if (quotas.kju > 0) {
            console.log(`✅ KJU: Cota preenchida pelo Drive (${driveCountKju}/${quotas.kju})`);
        }

        const driveCountZzMall = driveProducts.filter(p => p.loja === 'zzmall').length;
        const remainingQuotaZzMall = Math.max(0, quotas.zzmall - driveCountZzMall);

        if (remainingQuotaZzMall > 0) {
            try {
                const { scrapeZZMall } = require('./scrapers/zzmall');
                let products = await scrapeZZMall(remainingQuotaZzMall, context);
                products.forEach(p => p.message = buildZzMallMessage(p));
                allProducts.push(...products);
                console.log(`✅ ZZMall: ${products.length} msgs geradas`);
            } catch (e) { console.error(`❌ ZZMall Error: ${e.message}`); }
        } else if (quotas.zzmall > 0) {
            console.log(`✅ ZZMall: Cota preenchida pelo Drive (${driveCountZzMall}/${quotas.zzmall})`);
        }

        const driveCountLive = driveProducts.filter(p => p.loja === 'live').length;
        const remainingQuotaLive = Math.max(0, quotas.live - driveCountLive);

        // 2. LIVE Special Handling (Sets)
        if (remainingQuotaLive > 0) {
            try {
                const { scrapeLive } = require('./scrapers/live');
                let products = await scrapeLive(remainingQuotaLive, false, context);

                let i = 0;
                while (i < products.length) {
                    const current = products[i];
                    let chunk = [];

                    if (current.type === 'onepiece') {
                        // Peça única -> Mantém objeto original
                        chunk = [current];
                        i++;
                    } else {
                        // Par Top + Bottom (qualquer)
                        const next = products[i + 1];
                        if (next && next.type !== 'onepiece') {
                            // MERGE 2 produtos em 1 objeto SET
                            console.log(`   🔗 Merging ${current.nome} + ${next.nome}`);

                            const mergedProduct = {
                                ...current,
                                id: `${current.id}_${next.id}`,
                                nome: `${current.nome} + ${next.nome}`,
                                preco: parseFloat((current.preco + next.preco).toFixed(2)),
                                precoOriginal: parseFloat(((current.precoOriginal || current.preco) + (next.precoOriginal || next.preco)).toFixed(2)),
                                // Mantém imagem do Top (geralmente mais representativo) ou poderia tentar outra estratégia
                                // User não pediu imagem composta, apenas "não enviar 2 produtos"
                                imageUrl: current.imageUrl,
                                imagePath: current.imagePath,
                                link: current.url, // Link do Top
                                loja: 'live',
                                set: true
                            };

                            chunk = [mergedProduct];
                            i += 2;
                        } else {
                            // Órfão (Top/Bottom sem par) - Envia single ou descarta?
                            // Se não tiver par, envia single.
                            chunk = [current];
                            i++;
                        }
                    }

                    // Gera mensagem e adiciona ao output final
                    if (chunk.length > 0) {
                        // Se for merge set, só tem 1 item no chunk
                        const msg = buildLiveMessage(chunk);
                        chunk.forEach(p => p.message = msg);
                        allProducts.push(...chunk);
                    }
                }
                console.log(`✅ LIVE: ${products.length} produtos processados`);
            } catch (e) { console.error(`❌ LIVE Error: ${e.message}`); }
        } else if (quotas.live > 0) {
            console.log(`✅ LIVE: Cota preenchida pelo Drive (${driveCountLive}/${quotas.live})`);
        }

        // 3. REDISTRIBUIÇÃO (Garantir 12 produtos)
        let totalTarget = Object.values(quotas).reduce((a, b) => a + b, 0);
        let gap = totalTarget - allProducts.length;

        if (gap > 0) {
            console.log(`\n⚖️ Cota não atingida (${allProducts.length}/${totalTarget}). Lacuna de ${gap} produtos.`);

            // STRATEGY 1: CHECK REMAINING DRIVE ITEMS
            if (allUnusedDriveItems.length > 0) {
                console.log(`\n⚖️ Prioridade Redistribuição: Analisando ${allUnusedDriveItems.length} itens do Drive restantes (Todas as lojas)...`);

                try {
                    // Ordenar por prioridade
                    const driveFillCandidates = allUnusedDriveItems.sort((a, b) => getPriorityScore(b, history) - getPriorityScore(a, history));

                    console.log(`   🔎 Tentando recuperar itens do Drive harmoniosamente...`);

                    // Marcamos esses candidatos com a flag driveExhausted
                    const exhaustedWithFlags = driveFillCandidates.map(item => ({ ...item, driveExhausted: true }));

                    // Agrupar candidatos por loja para processar o gap harmoniosamente
                    const candidatesByStore = {};
                    exhaustedWithFlags.forEach(item => {
                        if (!candidatesByStore[item.store]) candidatesByStore[item.store] = [];
                        candidatesByStore[item.store].push(item);
                    });

                    // Round-robin entre as lojas que têm itens
                    const finalSelection = [];
                    const storeKeys = Object.keys(candidatesByStore);
                    let idx = 0;
                    while (finalSelection.length < gap && storeKeys.length > 0) {
                        const store = storeKeys[idx % storeKeys.length];
                        const list = candidatesByStore[store];
                        if (list && list.length > 0) {
                            finalSelection.push(list.shift());
                        } else {
                            storeKeys.splice(idx % storeKeys.length, 1);
                            continue;
                        }
                        idx++;
                    }

                    console.log(`   📦 Selecionados ${finalSelection.length} itens para preenchimento de gap.`);

                    // Processar cada loja separadamente
                    for (const store of [...new Set(finalSelection.map(i => i.store))]) {
                        const storeItems = finalSelection.filter(i => i.store === store);
                        const storeGap = storeItems.length;

                        console.log(`   🔄 Recuperando ${storeGap} itens extras de ${store.toUpperCase()}...`);

                        let results;
                        if (store === 'farm') {
                            results = await scrapeSpecificIds(context, storeItems, storeGap);
                        } else {
                            results = await scrapeSpecificIdsGeneric(context, storeItems, store, storeGap);
                        }

                        const products = results.products || [];
                        products.forEach(p => {
                            if (store === 'farm') p.message = buildFarmMessage(p, p.timerData);
                            else if (store === 'dressto') p.message = buildDressMessage(p);
                            else if (store === 'kju') p.message = buildKjuMessage(p);
                            else if (store === 'live') p.message = buildLiveMessage([p]);
                            else if (store === 'zzmall') p.message = buildZzMallMessage(p);

                            p.novidade = !!(p.novidade || p.isNovidade);
                            p.favorito = !!(p.favorito || p.isFavorito);
                        });

                        const pickedIds = new Set(allProducts.map(p => p.id));
                        const uniqueFound = products.filter(p => !pickedIds.has(p.id));
                        allProducts.push(...uniqueFound);
                    }

                    gap = totalTarget - allProducts.length;
                } catch (driveRedistErr) {
                    console.error(`❌ Erro Redistribuição Drive: ${driveRedistErr.message}`);
                }
            } else {
                console.log(`\n⚠️ Sem itens 'allUnusedDriveItems' disponíveis para redistribuição.`);
            }

            // STRATEGY 2: GENERIC SCRAPE (FALLBACK DO FALLBACK)
            if (gap > 0 && allUnusedDriveItems.length === 0) {
                console.log(`\n🔄 Preenchendo lacuna restante (${gap}) com FARM (Genérico)...`);
                console.log(`   ⚠️ CUIDADO: Verificando se Farm é Drive-Only...`);

                if (DRIVE_ONLY_STORES.includes('farm')) {
                    console.log(`   🚫 [FARM] Abortando: Farm é restrita ao Drive. Não haverá preenchimento genérico.`);
                } else {
                    console.log(`   ⚠️ Drive completamente esgotado. Usando scraping regular como último recurso.`);

                    let attempts = 0;
                    const maxAttempts = 2;

                    while (gap > 0 && attempts < maxAttempts) {
                        attempts++;
                        try {
                            const { scrapeFarm } = require('./scrapers/farm');
                            let extraProducts = await scrapeFarm(gap + 1, false, browser);

                            const alreadyPickedIds = new Set(allProducts.map(p => p.id));
                            const filteredExtra = extraProducts.filter(p => !alreadyPickedIds.has(p.id)).slice(0, gap);

                            filteredExtra.forEach(p => p.message = buildFarmMessage(p, p.timerData));
                            allProducts.push(...filteredExtra);

                            gap = totalTarget - allProducts.length;
                            console.log(`♻️ Redistribuição (Genérica): +${filteredExtra.length} produtos`);
                        } catch (e) {
                            console.error(`❌ Falha na redistribuição genérica (tentativa ${attempts}): ${e.message}`);
                            break;
                        }
                    }
                }
            } else if (gap > 0 && unusedFarmDriveItems.length > 0) {
                console.log(`\n⚠️ Lacuna de ${gap} produtos restante, mas ainda há ${unusedFarmDriveItems.length} itens no Drive.`);
                console.log(`   💡 Os itens não processados ainda não foram tentados. Se o log acima mostra muitos "não encontrados", verifique a disponibilidade.`);
            }
        }

        console.log('\n==================================================');
        console.log(`RESULTADO FINAL: ${allProducts.length}/${totalTarget} produtos coletados`);
        console.log('Aplicando ordenação de prioridade final...');

        console.log('Aplicando motor de distribuição final...');
        const distributedProducts = distributeLinks(allProducts);

        console.log(`Mensagens finais selecionadas: ${distributedProducts.length}`);
        console.log('==================================================');

        return distributedProducts;

    } catch (error) {
        console.error(`❌ Erro no Orchestrator: ${error.message}`);
        return allProducts;
    } finally {
        if (browser) {
            console.log('🔒 Encerrando Navegador Mestre...');
            await browser.close();
        }
    }
}

module.exports = { runAllScrapers };
