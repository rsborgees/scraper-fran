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

async function runAllScrapers(overrideQuotas = null) {
    const allProducts = [];
    const quotas = overrideQuotas || {
        farm: 12,
        dressto: 2,
        kju: 1,
        live: 2,
        zzmall: 1
    };

    try {
        console.log(`🚀 ORCHESTRATOR: Meta 17 Itens [F:${quotas.farm} D:${quotas.dressto} K:${quotas.kju} L:${quotas.live} Z:${quotas.zzmall}]`);

        // =================================================================
        // PHASE 1: GOOGLE DRIVE PRIORITY
        // =================================================================
        const driveProducts = [];
        let driveItemsByStore = { farm: [], dressto: [], kju: [], zzmall: [], live: [] };

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
                const farmDriveItems = driveItemsByStore.farm;
                if (farmDriveItems.length > 0) {
                    const { browser } = await initBrowser();

                    try {
                        const scrapedDriveItems = await scrapeSpecificIds(browser, farmDriveItems);
                        scrapedDriveItems.forEach(p => p.message = buildFarmMessage(p, p.timerData));

                        allProducts.push(...scrapedDriveItems);
                        driveProducts.push(...scrapedDriveItems);

                    } finally {
                        await browser.close();
                    }
                }

                // TODO: Implementar idScanner para outras lojas quando necessário
                // dressto, kju, zzmall, live - por enquanto só Farm tem scraper de ID específico
            }
        } catch (driveErr) {
            console.error('❌ Erro Phase 1 (Drive):', driveErr.message);
        }

        // Ajusta Quotas restantes
        const driveCountFarm = driveProducts.filter(p => p.loja === 'farm').length;
        const remainingQuotaFarm = Math.max(0, quotas.farm - driveCountFarm);

        console.log(`📊 Pós-Drive: ${driveCountFarm} itens Farm capturados. Restam ${remainingQuotaFarm} para scraping regular.`);

        // =================================================================
        // PHASE 2: REGULAR SCRAPING
        // =================================================================

        // 1. Scrapes
        if (remainingQuotaFarm > 0) {
            try {
                let products = await scrapeFarm(remainingQuotaFarm);
                products.forEach(p => p.message = buildFarmMessage(p, p.timerData));
                allProducts.push(...products);
                console.log(`✅ FARM (Regular): ${products.length} msgs geradas`);
            } catch (e) { console.error(`❌ FARM Error: ${e.message}`); }
        }

        try {
            const { scrapeDressTo } = require('./scrapers/dressto');
            let products = await scrapeDressTo(quotas.dressto);
            products.forEach(p => p.message = buildDressMessage(p));
            allProducts.push(...products);
            console.log(`✅ DressTo: ${products.length} msgs geradas`);
        } catch (e) { console.error(`❌ DressTo Error: ${e.message}`); }

        try {
            const { scrapeKJU } = require('./scrapers/kju');
            let products = await scrapeKJU(quotas.kju);
            products.forEach(p => p.message = buildKjuMessage(p));
            allProducts.push(...products);
            console.log(`✅ KJU: ${products.length} msgs geradas`);
        } catch (e) { console.error(`❌ KJU Error: ${e.message}`); }

        try {
            const { scrapeZZMall } = require('./scrapers/zzmall');
            let products = await scrapeZZMall(quotas.zzmall);
            products.forEach(p => p.message = buildZzMallMessage(p));
            allProducts.push(...products);
            console.log(`✅ ZZMall: ${products.length} msgs geradas`);
        } catch (e) { console.error(`❌ ZZMall Error: ${e.message}`); }

        // 2. LIVE Special Handling (Sets)
        // 2. LIVE Special Handling (Sets & One Pieces)
        try {
            const { scrapeLive } = require('./scrapers/live');
            let products = await scrapeLive(quotas.live);

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

        // 3. REDISTRIBUIÇÃO (Garantir 12 produtos)
        let totalTarget = Object.values(quotas).reduce((a, b) => a + b, 0);
        let gap = totalTarget - allProducts.length;

        if (gap > 0) {
            console.log(`\n⚖️ Cota não atingida (${allProducts.length}/${totalTarget}). Tentando preencher lacuna de ${gap} produtos com a FARM...`);

            let attempts = 0;
            const maxAttempts = 2; // Reduzi de 3 para 2 para ser mais rápido

            while (gap > 0 && attempts < maxAttempts) {
                attempts++;
                console.log(`\n🔄 Preenchendo lacuna com FARM (Tentativa #${attempts})...`);

                try {
                    const { scrapeFarm } = require('./scrapers/farm');
                    // Pede apenas o necessário (+ margem pequena) para evitar Deep Scan infinito
                    let extraProducts = await scrapeFarm(gap + 1);

                    // Filtra o que já pegamos nesta rodada (por ID)
                    const alreadyPickedIds = new Set(allProducts.map(p => p.id));
                    const filteredExtra = extraProducts.filter(p => !alreadyPickedIds.has(p.id)).slice(0, gap);

                    filteredExtra.forEach(p => p.message = buildFarmMessage(p, p.timerData));
                    allProducts.push(...filteredExtra);

                    gap = totalTarget - allProducts.length;
                    console.log(`♻️ Redistribuição: +${filteredExtra.length} produtos (Total atual: ${allProducts.length}/${totalTarget})`);
                } catch (e) {
                    console.error(`❌ Falha na redistribuição (tentativa ${attempts}): ${e.message}`);
                    break; // Sai do loop em caso de erro crítico
                }
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

    }
}

module.exports = { runAllScrapers };
