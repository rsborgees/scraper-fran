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
const { getRemainingQuotas, recordSentItems } = require('./dailyStatsManager');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner'); // MOVIDO PARA CIMA
const { RUN_CAPS } = require('./distributionEngine'); // Para limitar quota por run


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

    // 0. Bazar Priority (Absolute priority for this feature)
    if (item.bazar || item.bazarFavorito) score += 10000;

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

    // 1. Obter quotas restantes do dia
    const remaining = getRemainingQuotas();

    // 2. Definir meta para ESTA execução (Total ~11 para chegar em 165)
    const itemsPerRun = 11;

    // Distribuição proporcional baseada no que FALTA para o dia
    const quotas = overrideQuotas || {
        farm: Math.min(100, remaining.stores.farm), // Allow large pool for selection
        dressto: Math.min(10, remaining.stores.dressto),
        kju: Math.min(3, remaining.stores.kju),   // scrape pool pequeno; 1 por run via RUN_CAPS
        live: Math.min(10, remaining.stores.live),
        zzmall: Math.min(2, remaining.stores.zzmall) // 3 por dia max; 1 por run
    };

    // Ajuste se o total for menor que o esperado
    const currentTarget = Object.values(quotas).reduce((a, b) => a + b, 0);
    console.log(`📊 [Orchestrator] Meta desta rodada: ${currentTarget} itens. Falta para o dia: ${remaining.total}`);

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

                let farmDriveItems = Array.from(uniqueFarmItems.values()).filter(item => {
                    // EXCLUSÃO: Favoritos e Novidades são apenas para o Job das 05h
                    if (item.isFavorito || item.novidade || item.favorito || item.isNovidade) return false;

                    // Farm Drive: 48h (2 dias)
                    return !isDuplicate(normalizeId(item.id), { force: false, maxAgeHours: 48 }, item.preco);
                });

                // Fallback: se o pool de 48h ficou vazio (comum no servidor que roda 15x/dia),
                // aceitar itens enviados há mais de 24h para não deixar Farm sem conteúdo
                if (farmDriveItems.length < 10) {
                    const alreadyIds = new Set(farmDriveItems.map(i => normalizeId(i.id)));
                    const fallback24h = Array.from(uniqueFarmItems.values()).filter(item => {
                        if (item.isFavorito || item.novidade || item.favorito || item.isNovidade) return false;
                        if (alreadyIds.has(normalizeId(item.id))) return false;
                        return !isDuplicate(normalizeId(item.id), { force: true, maxAgeHours: 24 }, item.preco);
                    });
                    if (fallback24h.length > 0) {
                        console.log(`   ⚠️ [FARM] Pool de 48h pequeno (${farmDriveItems.length}). Aplicando fallback de 24h (+${fallback24h.length} itens).`);
                        farmDriveItems = [...farmDriveItems, ...fallback24h];
                    }
                }

                if (farmDriveItems.length > 0) {
                    // ESTRATÉGIA: Garantir mix de Bazar e Regular no Scrape
                    const bazars = farmDriveItems.filter(i => i.bazar).sort((a, b) => getPriorityScore(b, history) - getPriorityScore(a, history));
                    const normals = farmDriveItems.filter(i => !i.bazar).sort((a, b) => getPriorityScore(b, history) - getPriorityScore(a, history));

                    // Intercalar para garantir que o 'farmQuota' pegue de ambos
                    // Priorizamos NO MÁXIMO 3 bazares no pool. O resto TEM que ser preenchido pelos Normais.
                    const maxBazars = 3;
                    const limitedBazars = bazars.slice(0, maxBazars);

                    const sortedFarmDriveItems = [];
                    let bIdx = 0, rIdx = 0;

                    // Garante que tenhamos muitos normais no pool de scraping
                    while (rIdx < normals.length || bIdx < limitedBazars.length) {
                        if (rIdx < normals.length) sortedFarmDriveItems.push(normals[rIdx++]);
                        if (rIdx < normals.length) sortedFarmDriveItems.push(normals[rIdx++]); // 2 normais
                        if (bIdx < limitedBazars.length) sortedFarmDriveItems.push(limitedBazars[bIdx++]); // 1 bazar até acabar os 3
                    }

                    console.log(`📊 [FARM] Totais no Drive: ${bazars.length} Bazar (Usando máx ${maxBazars}), ${normals.length} Regular.`);

                    // GARANTIA: Mínimo 25 para garantir que tenhamos itens REGULARES além dos BAZAR
                    // O farmQuota aqui é apenas para o SCRAPING, o distributionEngine aplicará a cota final de 7.
                    const farmQuota = 25;

                    // Reutiliza o browser instanciado
                    // UPDATE: Agora retorna objeto com stats
                    const { products: scrapedDriveItems, attemptedIds, stats } = await scrapeSpecificIds(context, sortedFarmDriveItems, farmQuota);

                    scrapedDriveItems.forEach(p => {
                        p.message = buildFarmMessage(p, p.timerData);
                    });

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
                // require ja no topo

                for (const store of otherStores) {
                    // Removemos novidades e favoritos para o job horário
                    const items = (driveItemsByStore[store] || []).filter(item => {
                        return !item.isFavorito && !item.novidade && !item.favorito && !item.isNovidade;
                    });

                    if (items.length > 0) {
                        const limitedItems = items
                            .sort((a, b) => getPriorityScore(b, history) - getPriorityScore(a, history))
                            .slice(0, 50);

                        console.log(`🔍 [${store.toUpperCase()}] Iniciando Drive-First (${items.length} itens)...`);

                        // Usa o RUN_CAP do distributionEngine como quota: o scanner para cedo quando atingido
                        let currentQuota = RUN_CAPS[store] || quotas[store] || 1;
                        if (store === 'dressto') currentQuota = Math.min(4, quotas.dressto || 4);

                        const { products: scrapedItems, stats } = await scrapeSpecificIdsGeneric(context, limitedItems, store, currentQuota);

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
                            const driveItem = limitedItems.find(item => normalizeId(item.id) === normalizeId(p.id));
                            p.bazar = !!(p.bazar || driveItem?.bazar);
                            p.isBazar = p.bazar;
                            p.bazarFavorito = !!(p.bazarFavorito || (p.bazar && p.favorito));
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

                    let candidates = dressItems.filter(item => {
                        if (item.isFavorito || item.novidade || item.favorito || item.isNovidade) return false;
                        const finalId = item.driveId || item.id;
                        return !isDuplicate(finalId, { force: false, maxAgeHours: 48 });
                    });

                    // Passo 2: Fallback se pool for pequeno (Aceita repetição de 24h para qualquer uno)
                    // Consideramos "pool pequeno" se tivermos menos candidatos que a cota da Dress To
                    if (candidates.length < quotas.dressto) {
                        console.log(`   ⚠️ [DRESSTO] Poucos itens novos no Drive. Aplicando fallback de repetição (24h)...`);
                        const fallbackCandidates = dressItems.filter(item => {
                            const finalId = item.driveId || item.id;
                            const normId = normalizeId(finalId);
                            if (candidates.some(c => normalizeId(c.driveId || c.id) === normId)) return false;
                            return !isDuplicate(finalId, { force: true, maxAgeHours: 24 });
                        });
                        candidates = [...candidates, ...fallbackCandidates];
                    }

                    console.log(`   👗 [DRESSTO] Pool final para cota ${quotas.dressto}: ${candidates.length} candidatos.`);

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
                        const driveItem = limitedItems.find(item => normalizeId(item.id) === normalizeId(p.id));
                        p.bazar = !!(p.bazar || driveItem?.bazar);
                        p.isBazar = p.bazar;
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

        // Farm: 100% DRIVE ONLY - Usuário requisitou NUNCA pegar peças do site, de jeito nenhum.
        const farmNormalCount = allProducts.filter(p => p.loja === 'farm' && !p.bazar && !p.isBazar).length;
        const unusedNormalFarm = allUnusedDriveItems.filter(i => i.store === 'farm' && !i.bazar).length;
        const farmShouldScrapeSite = false; 

        if (farmShouldScrapeSite) {
            console.log(`🌐 [FARM] Nenhum item normal recuperado do Drive. Iniciando scraping regular do site (Fallback)...`);
            try {
                const siteQuota = Math.max(7, remainingQuotaFarm);
                let products = await scrapeFarm(siteQuota, false, context);
                products.forEach(p => p.message = buildFarmMessage(p, p.timerData));
                allProducts.push(...products);
                console.log(`✅ FARM (Regular Site): ${products.length} msgs geradas`);
            } catch (e) { console.error(`❌ FARM Error: ${e.message}`); }
        } else {
            console.log(`⏭️ [FARM] Drive tem ${farmNormalCount} itens normais + ${unusedNormalFarm} no pool. Pulando site.`);
        }

        // --- NOVIDADES DO SITE (Removido) ---
        // Removido da execução horária para não enviar novidades/favoritos. 
        // Apenas o Job de 05h deve enviar novidades.

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

        // Dress To é sempre Drive-only — sem scraping regular do site
        if (quotas.dressto > 0) {
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
                            p.isNovidade = p.novidade;
                            p.favorito = !!(p.favorito || p.isFavorito);
                            p.isFavorito = p.favorito;
                            const driveItem = storeItems.find(item => normalizeId(item.id) === normalizeId(p.id));
                            p.bazar = !!(p.bazar || driveItem?.bazar);
                            p.isBazar = p.bazar;
                            p.bazarFavorito = !!(p.bazarFavorito || (p.bazar && p.favorito));
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
            } else if (gap > 0) {
                const unusedFarmDriveItems = allUnusedDriveItems.filter(i => i.store === 'farm');
                if (unusedFarmDriveItems.length > 0) {
                    console.log(`\n⚠️ Lacuna de ${gap} produtos restante, mas ainda há ${unusedFarmDriveItems.length} itens no Drive.`);
                    console.log(`   💡 Os itens não processados ainda não foram tentados. Se o log acima mostra muitos "não encontrados", verifique a disponibilidade.`);
                }
            }
        }

        console.log('\n==================================================');
        console.log(`RESULTADO FINAL: ${allProducts.length}/${totalTarget} produtos coletados`);
        console.log('Aplicando ordenação de prioridade final...');

        const countsByStore = allProducts.reduce((acc, p) => {
            const s = (p.loja || p.brand || 'unknown').toLowerCase();
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        }, {});
        console.log('📦 Pool de produtos coletados:', countsByStore);

        console.log('Aplicando motor de distribuição final...');
        // Forçamos o target de 7 para Farm no distribution engine para garantir a regra 1+6
        const activeQuotas = { ...quotas, farm: Math.min(7, remaining.stores.farm) };
        const distributedProducts = distributeLinks(allProducts, activeQuotas, remaining);

        // Debug Log for Bazar Flag
        console.log('\n📊 [Orchestrator] Concluindo Distribuição. Verificando Flag Bazar:');
        distributedProducts.forEach(p => {
            console.log(`   🔸 ${p.nome} (${p.id}): Bazar=${!!p.bazar} | isBazar=${!!p.isBazar}`);
        });

        // ======= NOVO REQUERIDO PELO USUÁRIO: RESUMO FINAL ORGANIZADO =======
        console.log('\n==================================================');
        console.log('🛍️ RESUMO DOS PRODUTOS SELECIONADOS:');
        console.log('==================================================');
        
        const groupedByStore = {};
        distributedProducts.forEach(p => {
            const store = (p.loja || p.brand || 'OUTRA').toUpperCase();
            if (!groupedByStore[store]) groupedByStore[store] = [];
            groupedByStore[store].push(p);
        });

        Object.keys(groupedByStore).sort().forEach(store => {
            console.log(`\n🏪 ${store} (${groupedByStore[store].length} itens):`);
            groupedByStore[store].forEach((p, idx) => {
                const tipo = p.bazar ? '[BAZAR]' : p.favorito ? '[FAVORITO]' : p.novidade ? '[NOVIDADE]' : '[REGULAR]';
                console.log(`   ${String(idx + 1).padStart(2, ' ')}. ${tipo} ${p.nome} | R$ ${p.precoAtual || p.preco}`);
            });
        });
        console.log('\n==================================================\n');
        // ====================================================================

        // 4. Gravar Stats Diárias e Marcar como Enviado
        if (distributedProducts.length > 0) {
            const { markAsSent } = require('./historyManager');
            const allIds = distributedProducts.map(p => p.id);
            markAsSent(allIds);
            recordSentItems(distributedProducts);
        }

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
