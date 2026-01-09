
const { runAllScrapers } = require('./orchestrator');

async function runProductionTest() {
    console.log('🚀 INICIANDO TESTE FINAL DE PRODUÇÃO (12 ITENS)');
    console.log('------------------------------------------------');

    // Usar quotas padrão (null) que são definidas no orchestrator como:
    // Farm: 7, DressTo: 1, KJU: 1, Live: 2, ZZMall: 1
    const products = await runAllScrapers();

    console.log('\n📊 RELATÓRIO DO TESTE');
    console.log('---------------------');
    console.log(`Total Coletado: ${products.length} / 12`);

    const countByStore = {};
    products.forEach(p => {
        countByStore[p.loja] = (countByStore[p.loja] || 0) + 1;
    });

    console.log('Distribuição por Loja:', countByStore);

    if (products.length === 12 && countByStore['farm'] === 7) {
        console.log('✅ SUCESSO: Cotas respeitadas.');
    } else {
        console.warn('⚠️ AVISO: Discrepância nas cotas.');
    }

    // Validação extra da Farm
    const farmProducts = products.filter(p => p.loja === 'farm');
    const dressCount = farmProducts.filter(p => p.categoria === 'Vestidos').length;
    const dressPct = (dressCount / farmProducts.length) * 100;

    console.log(`\nFARM DETAILS (${farmProducts.length}):`);
    console.log(`Vestidos: ${dressCount} (${dressPct.toFixed(1)}%)`);
}

runProductionTest().catch(e => console.error(e));
