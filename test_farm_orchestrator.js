const { runAllScrapers } = require('./orchestrator');

async function testFarmOnly() {
    console.log('🚀 Iniciando teste do Orchestrator (Apenas FARM)...');

    // Configura quota apenas para Farm
    const quotas = {
        farm: 2,     // 2 itens Farm (1 do site + 1 do drive/regular)
        dressto: 0,
        kju: 0,
        live: 0,
        zzmall: 0
    };

    try {
        const results = await runAllScrapers(quotas);

        console.log('\n==================================================');
        console.log(`📊 RESULTADO FINAL: ${results.length} mensagens geradas.`);

        results.forEach((p, i) => {
            console.log(`\n[${i + 1}] ${p.nome} (${p.id})`);
            console.log(`    Loja: ${p.loja}`);
            console.log(`    isSiteNovidade: ${p.isSiteNovidade || 'false'}`);
            console.log(`    isNovidade: ${p.isNovidade || 'false'}`);
            console.log(`    URL: ${p.url}`);
        });
        console.log('==================================================');

    } catch (error) {
        console.error('❌ Erro no teste do Orchestrator:', error);
    }
}

testFarmOnly();
