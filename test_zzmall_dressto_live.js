const { scrapeZZMall } = require('./scrapers/zzmall');
const { scrapeDressTo } = require('./scrapers/dressto');
const { scrapeLive } = require('./scrapers/live');

(async () => {
    console.log('🚀 INICIANDO TESTE CONSOLIDADO: ZZMALL, DRESSTO, LIVE\n');

    try {
        console.log('--- TESTANDO DRESSTO (Quota 2) ---');
        const dressProducts = await scrapeDressTo(2);
        console.log(`✅ DressTo: ${dressProducts.length} produtos coletados.`);

        console.log('\n--- TESTANDO ZZMALL (Quota 2) ---');
        const zzmallProducts = await scrapeZZMall(2);
        console.log(`✅ ZZMall: ${zzmallProducts.length} produtos coletados.`);

        console.log('\n--- TESTANDO LIVE (Quota 2) ---');
        const liveProducts = await scrapeLive(2);
        console.log(`✅ Live: ${liveProducts.length} produtos coletados.`);

        console.log('\n📊 RESUMO DO TESTE:');
        console.log('DressTo IDs:', dressProducts.map(p => p.id));
        console.log('ZZMall IDs:', zzmallProducts.map(p => p.id));
        console.log('Live IDs:', liveProducts.map(p => p.id));

    } catch (error) {
        console.error('❌ Erro no teste consolidado:', error);
    }

    process.exit(0);
})();
