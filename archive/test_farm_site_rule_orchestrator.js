const { runAllScrapers } = require('./orchestrator');

async function testFarmSiteRule() {
    console.log('🧪 Debugando estrutura no Orchestrator...');

    const quotas = {
        farm: 10,
        dressto: 0,
        kju: 0,
        live: 0,
        zzmall: 0
    };

    try {
        const products = await runAllScrapers(quotas);

        console.log(`\n📊 Total de produtos retornados: ${products.length}`);

        if (products.length > 0) {
            console.log('📝 Amostra do primeiro produto:');
            console.log(JSON.stringify(products[0], (key, value) => key === 'message' ? '[MESSAGE]' : value, 2));
        }

        const farmItems = products.filter(p => (p.loja === 'farm' || p.store === 'farm'));
        console.log(`✅ Itens da Farm encontrados: ${farmItems.length}`);

        const siteItems = farmItems.filter(p => p.isSiteNovidade);
        console.log(`✅ Itens do Site (isSiteNovidade): ${siteItems.length}`);

    } catch (err) {
        console.error('❌ Erro no teste:', err);
    }
}

testFarmSiteRule();
