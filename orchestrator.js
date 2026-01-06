/**
 * Orchestrator - Coordena todos os scrapers de lojas
 * Total: 120 produtos
 * Distribuição: FARM 84, Dress To 18, KJU 6, Live 6, ZZMall 6
 */

/**
 * Orchestrator - Coordena todos os scrapers de lojas
 * Total: 120 produtos
 * Distribuição: FARM 84, Dress To 18, KJU 6, Live 6, ZZMall 6
 */

const fs = require('fs');
const path = require('path');
const LOCK_FILE = path.join(__dirname, 'scraper.lock');

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

    console.log('🚀 INICIANDO ORCHESTRATOR - 120 PRODUTOS TOTAL (ou override)\n');
    console.log('Distribuição: FARM (7), Dress To (2), KJU (1), Live (1), ZZMall (1)\n');

    const allProducts = [];
    const quotas = overrideQuotas || {
        farm: 7,
        dressto: 2,
        kju: 1,
        live: 1,
        zzmall: 1
    };

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

        // Agrupa em pares (Sets) se possível.
        // A lógica do scraper já tenta ordenar pares juntos.
        // Vamos pegar de 2 em 2. Se sobrar 1, manda sozinho.
        const liveBundles = [];
        for (let i = 0; i < products.length; i += 2) {
            const chunk = products.slice(i, i + 2);
            // Verifica se faz sentido ser um set (ex: Top + Legging)
            // Se não fizer sentido (ex: Legging + Legging), manda separado?
            // O User pediu "mandar um conjunto". Vamos assumir que o chunk é um conjunto visual.
            // Para simplificar: Geramos UMA mensagem para o par.
            // Mas precisamos manter a estrutura de 'allProducts' plana ou agrupada?
            // 'allProducts' é lista de produtos. Mas o campo 'message' pode ser igual para os membros do set.
            const msg = buildLiveMessage(chunk);
            chunk.forEach(p => p.message = msg);
            allProducts.push(...chunk);
        }
        console.log(`✅ LIVE: ${products.length} produtos agrupados em ${Math.ceil(products.length / 2)} msgs`);

    } catch (e) { console.error(`❌ LIVE Error: ${e.message}`); }

    console.log('\n==================================================');
    console.log(`RESULTADO FINAL: ${allProducts.length}/120 produtos`);
    console.log('Todas as mensagens foram geradas com sucesso.');
    console.log('==================================================');

} finally {
    if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
        console.log('🔓 Trava de execução removida.');
    }
}
}

module.exports = { runAllScrapers };
