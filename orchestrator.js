/**
 * Orchestrator - Coordena todos os scrapers de lojas
 * Total: 17 produtos
 * Distribuição: FARM 12, Dress To 1, KJU 1, Live 2, ZZMall 1
 */

const fs = require('fs');
const path = require('path');

const { initBrowser } = require('./browser_setup'); // Necessário para passar browser instancia

// Imports
const { scrapeFarm } = require('./scrapers/farm');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner'); // NOVO
const { getExistingIdsFromDrive } = require('./driveManager');
const { isDuplicate, normalizeId } = require('./historyManager'); // IMPORTADO PARA FILTRO PREVIO
const {
    buildKjuMessage,
    buildDressMessage,
    buildLiveMessage,
    buildFarmMessage,
    buildZzMallMessage
} = require('./messageBuilder');

async function runAllScrapers(overrideQuotas = null) {
    const allProducts = [];
    const quotas = overrideQuotas || {
        farm: 5,
        dressto: 2,
        kju: 1,
        live: 1,
        zzmall: 1
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
        const driveProducts = [];
        let driveItemsByStore = { farm: [], dressto: [], kju: [], zzmall: [], live: [] };
        let unusedFarmDriveItems = [];

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
                    return !isDuplicate(normalizeId(item.id));
                });

                if (farmDriveItems.length > 0) {
                    // Ordenar por Favorito primeiro e passar TODOS os itens disponíveis
                    // O scraper vai processar até atingir a quota total (não só a quota inicial)
                    const sortedFarmDriveItems = farmDriveItems
                        .sort((a, b) => (b.isFavorito ? 1 : 0) - (a.isFavorito ? 1 : 0));

                    console.log(`📊 [FARM] ${sortedFarmDriveItems.length} itens disponíveis no Drive (${farmDriveItems.filter(i => i.isFavorito).length} favoritos)`);

                    // IMPORTANTE: Passa TODOS os candidatos do Drive, não limita a 50
                    // O scraper interno vai respeitar a quota total do orchestrator
                    const totalQuota = Object.values(quotas).reduce((a, b) => a + b, 0);

                    // Reutiliza o browser instanciado
                    const scrapedDriveItems = await scrapeSpecificIds(context, sortedFarmDriveItems, totalQuota);
                    scrapedDriveItems.forEach(p => p.message = buildFarmMessage(p, p.timerData));

                    allProducts.push(...scrapedDriveItems);
                    driveProducts.push(...scrapedDriveItems);

                    // SALVAR O RESTO PARA REDISTRIBUIÇÃO
                    // Remove os que foram efetivamente 'processados' (enviados) da lista de candidatos
                    const processedIds = new Set(scrapedDriveItems.map(p => normalizeId(p.id)));

                    // Guarda o que sobrou da lista `farmDriveItems` original (não só da limited)
                    // Filtra o que já foi e o que já sabemos que é duplicado (mas o filtro inicial já cuidou disso na maioria)
                    unusedFarmDriveItems = farmDriveItems.filter(item => !processedIds.has(normalizeId(item.id)));
                }

                // =================================================================
                // 🚗 DRIVE-FIRST FOR OTHER STORES (Dressto, KJU, ZZMall, Live)
                // =================================================================
                const otherStores = ['dressto', 'kju', 'zzmall', 'live'];
                const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');

                for (const store of otherStores) {
                    const items = driveItemsByStore[store].filter(item => {
                        if (item.isFavorito) return true;
                        return !isDuplicate(normalizeId(item.id));
                    });

                    if (items.length > 0) {
                        const limitedItems = items
                            .sort((a, b) => (b.isFavorito ? 1 : 0) - (a.isFavorito ? 1 : 0))
                            .slice(0, 50);

                        console.log(`🔍 [${store.toUpperCase()}] Iniciando Drive-First (${items.length} itens)...`);
                        const scrapedItems = await scrapeSpecificIdsGeneric(context, limitedItems, store, quotas[store]);

                        // Apply message builder
                        scrapedItems.forEach(p => {
                            if (store === 'dressto') p.message = buildDressMessage(p);
                            else if (store === 'kju') p.message = buildKjuMessage(p);
                            else if (store === 'live') p.message = buildLiveMessage([p]); // Live expects array
                            else if (store === 'zzmall') p.message = buildZzMallMessage(p);
                        });

                        allProducts.push(...scrapedItems);
                        driveProducts.push(...scrapedItems);
                    }
                }
            }
        } catch (driveErr) {
            console.error('❌ Erro Phase 1 (Drive):', driveErr.message);
        }

        // Ajusta Quotas restantes
        const driveCountFarm = driveProducts.filter(p => p.loja === 'farm').length;
        const remainingQuotaFarm = Math.max(0, quotas.farm - driveCountFarm);

        console.log(`📊 Pós-Drive: ${driveCountFarm} itens Farm capturados. Restam ${remainingQuotaFarm} para scraping regular.`);
        console.log(`📊 Itens Farm não utilizados do Drive: ${unusedFarmDriveItems.length}`);

        // =================================================================
        // PHASE 2: REGULAR SCRAPING
        // =================================================================

        // 1. Scrapes (Passando o objeto browser)
        // IMPORTANTE: Só faz scraping regular se NÃO houver mais itens no Drive
        if (remainingQuotaFarm > 0 && unusedFarmDriveItems.length === 0) {
            console.log(`🌐 [FARM] Drive esgotado. Iniciando scraping regular...`);
            try {
                let products = await scrapeFarm(remainingQuotaFarm, false, context);
                products.forEach(p => p.message = buildFarmMessage(p, p.timerData));
                allProducts.push(...products);
                console.log(`✅ FARM (Regular): ${products.length} msgs geradas`);
            } catch (e) { console.error(`❌ FARM Error: ${e.message}`); }
        } else if (remainingQuotaFarm > 0 && unusedFarmDriveItems.length > 0) {
            console.log(`⏭️ [FARM] Pulando scraping regular. Ainda há ${unusedFarmDriveItems.length} itens no Drive para redistribuição.`);
        }

        const driveCountDressTo = driveProducts.filter(p => p.loja === 'dressto').length;
        const remainingQuotaDressTo = Math.max(0, quotas.dressto - driveCountDressTo);

        if (remainingQuotaDressTo > 0) {
            try {
                const { scrapeDressTo } = require('./scrapers/dressto');
                let products = await scrapeDressTo(remainingQuotaDressTo, context);
                products.forEach(p => p.message = buildDressMessage(p));
                allProducts.push(...products);
                console.log(`✅ DressTo: ${products.length} msgs geradas`);
            } catch (e) { console.error(`❌ DressTo Error: ${e.message}`); }
        } else if (quotas.dressto > 0) {
            console.log(`✅ DressTo: Cota preenchida pelo Drive (${driveCountDressTo}/${quotas.dressto})`);
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
            if (unusedFarmDriveItems.length > 0) {
                console.log(`\n🚙 Prioridade Redistribuição: Usando ${unusedFarmDriveItems.length} itens do Drive restantes...`);

                try {
                    // Passa TODOS os candidatos restantes, mas ordenados por PRIORIDADE (Favorito primeiro)
                    const driveFillCandidates = unusedFarmDriveItems.sort((a, b) => (b.isFavorito ? 1 : 0) - (a.isFavorito ? 1 : 0));

                    console.log(`   🔎 Tentando recuperar de ${driveFillCandidates.length} IDs disponíveis no Drive...`);

                    const driveFilledProducts = await scrapeSpecificIds(browser, driveFillCandidates, gap);
                    console.log(`   ✅ Retornados do Drive-Scraper: ${driveFilledProducts.length} itens.`);

                    driveFilledProducts.forEach(p => p.message = buildFarmMessage(p, p.timerData));

                    // Add unique only
                    const alreadyPickedIds = new Set(allProducts.map(p => p.id));
                    const newDriveItems = driveFilledProducts.filter(p => !alreadyPickedIds.has(p.id));

                    if (newDriveItems.length === 0 && driveFilledProducts.length > 0) {
                        console.log(`   ⚠️ Todos os itens recuperados já estavam na lista principal.`);
                    }

                    allProducts.push(...newDriveItems);
                    gap = totalTarget - allProducts.length;

                    console.log(`♻️ Redistribuição (Drive): +${newDriveItems.length} itens.`);
                } catch (driveRedistErr) {
                    console.error(`❌ Erro Redistribuição Drive: ${driveRedistErr.message}`);
                }
            } else {
                console.log(`\n⚠️ Sem itens 'unusedFarmDriveItems' disponíveis para redistribuição.`);
            }



            // STRATEGY 2: GENERIC SCRAPE (FALLBACK DO FALLBACK)
            // Só faz scraping genérico se o Drive estiver COMPLETAMENTE ESGOTADO
            if (gap > 0 && unusedFarmDriveItems.length === 0) {
                console.log(`\n🔄 Preenchendo lacuna restante (${gap}) com FARM (Genérico)...`);
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
            } else if (gap > 0 && unusedFarmDriveItems.length > 0) {
                console.log(`\n⚠️ Lacuna de ${gap} produtos restante, mas ainda há ${unusedFarmDriveItems.length} itens no Drive.`);
                console.log(`   💡 Considere aumentar a quota ou verificar se há problemas com os itens do Drive.`);
            }
        }

        console.log('\n==================================================');
        console.log(`RESULTADO FINAL: ${allProducts.length}/${totalTarget} produtos coletados`);
        console.log('Todas as mensagens foram geradas com sucesso.');
        console.log('==================================================');

        return allProducts;

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
