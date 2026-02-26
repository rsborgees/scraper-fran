const { runAllScrapers } = require('./orchestrator');
require('dotenv').config();

async function testFinal() {
    console.log('🧪 TESTE FINAL: COLETA DRESS TO via ORCHESTRATOR');

    // Força apenas Dress To com quota 2
    const overrideQuotas = {
        farm: 0,
        dressto: 2,
        kju: 0,
        live: 0,
        zzmall: 0
    };

    try {
        await runAllScrapers(overrideQuotas);
        console.log('\n✅ Teste de Dress To concluído.');
    } catch (e) {
        console.error('❌ Erro no teste:', e);
    }
}

testFinal();
