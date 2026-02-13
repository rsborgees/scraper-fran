const { runAllScrapers } = require('./orchestrator');
require('dotenv').config();

async function testPayloadAndRestriction() {
    console.log('🧪 Iniciando Verificação de Payload e Restrição Dress To...');

    // Test with small quotas
    const quotas = {
        farm: 1,
        dressto: 1,
        kju: 0,
        live: 0,
        zzmall: 0
    };

    try {
        const results = await runAllScrapers(quotas);

        console.log(`\n📊 Capturados ${results.length} produtos.`);

        let missingFavorito = 0;
        let nonBooleanFavorito = 0;

        results.forEach(p => {
            if (p.favorito === undefined) {
                console.error(`❌ Produto ${p.id} (${p.loja}) não tem o campo 'favorito'`);
                missingFavorito++;
            } else if (typeof p.favorito !== 'boolean') {
                console.error(`❌ Produto ${p.id} (${p.loja}) tem 'favorito' como ${typeof p.favorito}: ${p.favorito}`);
                nonBooleanFavorito++;
            }
        });

        if (missingFavorito === 0 && nonBooleanFavorito === 0) {
            console.log('✅ Tudo OK: Todos os produtos possuem o campo "favorito" como boolean.');
        }

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
}

testPayloadAndRestriction();
