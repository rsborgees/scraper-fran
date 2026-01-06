/**
 * Orchestrator - Coordena todos os scrapers de lojas
 * Total: 12 produtos
 * Distribuição: FARM 7, Dress To 2, KJU 1, Live 1, ZZMall 1
 */

const fs = require('fs');
const path = require('path');
const LOCK_FILE = path.join(__dirname, 'scraper.lock');
const {
    buildFarmMessage,
    buildDressMessage,
    buildKjuMessage,
    buildLiveMessage,
    buildZzMallMessage
} = require('./messageBuilder');

async function runAllScrapers(overrideQuotas = null) {
    // 🔒 Trava de execução para evitar sobreposição
    if (fs.existsSync(LOCK_FILE)) {
        const stats = fs.statSync(LOCK_FILE);
        const hoursOld = (new Date() - stats.mtime) / (1000 * 60 * 60);

        // Se a trava tiver mais de 2 horas, assumimos que o processo anterior travou e limpamos
        if (hoursOld > 2) {
            console.log('⚠️ Trava antiga detectada (>2h), removendo...');
            fs.unlinkSync(LOCK_FILE);
        } else {
            console.log('🚫 Scraper já está em execução. Abortando nova instância.');
            return [];
        }
    }

    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    console.log(`🔒 Trava de execução criada (PID: ${process.pid})`);

    const allProducts = [];
    const quotas = overrideQuotas || {
        farm: 7,
        dressto: 1,
        kju: 1,
        live: 2,
        zzmall: 1
    };

    try {
        console.log('🚀 INICIANDO ORCHESTRATOR - 12 PRODUTOS TOTAL (ou override)\n');
        console.log(`Distribuição: FARM (${quotas.farm}), Dress To (${quotas.dressto}), KJU (${quotas.kju}), Live (${quotas.live}), ZZMall (${quotas.zzmall})\n`);

        // 1. Scrapes
        try {
            const { scrapeFarm } = require('./scrapers/farm');
            let products = await scrapeFarm(quotas.farm);
            products.forEach(p => p.message = buildFarmMessage(p, p.timerData));
            allProducts.push(...products);
            console.log(`✅ FARM: ${products.length} msgs geradas`);
        } catch (e) { console.error(`❌ FARM Error: ${e.message}`); }

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
        try {
            const { scrapeLive } = require('./scrapers/live');
            let products = await scrapeLive(quotas.live);

            for (let i = 0; i < products.length; i += 2) {
                const chunk = products.slice(i, i + 2);
                const msg = buildLiveMessage(chunk);
                chunk.forEach(p => p.message = msg);
                allProducts.push(...chunk);
            }
            console.log(`✅ LIVE: ${products.length} produtos agrupados em ${Math.ceil(products.length / 2)} msgs`);
        } catch (e) { console.error(`❌ LIVE Error: ${e.message}`); }

        // 3. REDISTRIBUIÇÃO (Garantir 12 produtos)
        const totalTarget = Object.values(quotas).reduce((a, b) => a + b, 0);
        if (allProducts.length < totalTarget) {
            const gap = totalTarget - allProducts.length;
            console.log(`\n⚖️ Cota não atingida (${allProducts.length}/${totalTarget}). Tentando preencher lacuna de ${gap} produtos com a FARM...`);

            try {
                const { scrapeFarm } = require('./scrapers/farm');
                // Pede os produtos que faltam + margem de erro
                let extraProducts = await scrapeFarm(gap + 5);

                // Filtra o que já pegamos nesta rodada (por ID)
                const alreadyPickedIds = new Set(allProducts.map(p => p.id));
                const filteredExtra = extraProducts.filter(p => !alreadyPickedIds.has(p.id)).slice(0, gap);

                filteredExtra.forEach(p => p.message = buildFarmMessage(p, p.timerData));
                allProducts.push(...filteredExtra);

                console.log(`♻️ Redistribuição concluída: +${filteredExtra.length} produtos da FARM`);
            } catch (e) {
                console.error(`❌ Falha na redistribuição: ${e.message}`);
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
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
            console.log('🔓 Trava de execução removida.');
        }
    }
}

module.exports = { runAllScrapers };
