const { runAllScrapers } = require('./orchestrator');
require('dotenv').config();

async function testRotationAndHarmony() {
    console.log('🧪 Verificando Regras de Rotação e Harmonia...');

    // Small quota to trigger redistribution
    const quotas = {
        farm: 1,
        dressto: 0,
        kju: 0,
        live: 0,
        zzmall: 0
    };

    // total target 17 is default from runAllScrapers but we can force a small total to see redistribution
    // Actually runAllScrapers calculates total as sum of quotas if quotas is provided.
    // If I want redistribution, I should provide a total target higher than the sum of quotas? 
    // No, orchestrator calculates total as sum of quotas.

    // To trigger redistribution Strategy 1, I should have a store where finding items fails, 
    // or just set a store quota to 0 but have items in Drive for it.

    try {
        // We'll run with Farm:1. Since there are many items in Drive, Phase 1 will pick 1 Farm item.
        // Then it will see a gap? No, if Meta is sum of quotas, gap will be 0.
        // I'll modify the test to simulate a gap or just check the priority sorting in logs.

        console.log('--- TEST RUN 1: Priority Sorting ---');
        const results = await runAllScrapers({ farm: 2, dressto: 1 });

        console.log(`\n📊 Capturados ${results.length} produtos.`);
        results.forEach((p, i) => {
            console.log(`   [${i + 1}] ${p.loja} - ${p.nome} (ID: ${p.id})`);
        });

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
}

testRotationAndHarmony();
