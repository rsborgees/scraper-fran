const { runAllScrapers } = require('./orchestrator');
require('dotenv').config();

async function testDressToFunctionality() {
    console.log('🧪 Verificando Scraper Dress To (Pós-Alterações de Harmonia)...');

    // Run specifically for Dress To
    const quotas = {
        farm: 0,
        dressto: 3,
        kju: 0,
        live: 0,
        zzmall: 0
    };

    try {
        console.log('--- TEST RUN: Dress To Priority Sourcing ---');
        const results = await runAllScrapers(quotas);

        console.log(`\n📊 Capturados ${results.length} produtos Dress To.`);
        results.forEach((p, i) => {
            console.log(`   [${i + 1}] ${p.loja} - ${p.nome} (ID: ${p.id})`);
            console.log(`       Favorito: ${p.favorito}, Novidade: ${p.novidade}`);
        });

        if (results.length > 0) {
            console.log('\n✅ Teste concluído com sucesso.');
        } else {
            console.log('\n⚠️ Nenhum item capturado. Verifique se há IDs elegíveis no Drive.');
        }

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
}

testDressToFunctionality();
