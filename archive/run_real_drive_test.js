const { runAllScrapers } = require('./orchestrator');
require('dotenv').config();

async function runRealTest() {
    console.log('🚀 Iniciando Teste Real: Verificando itens do Google Drive...');

    // Quotas para o teste solicitado
    const quotas = {
        farm: 5,
        dressto: 0,
        kju: 0,
        live: 0,
        zzmall: 0
    };

    console.log(`📋 Configuração do Teste: Farm (${quotas.farm}), DressTo (${quotas.dressto})`);

    try {
        const results = await runAllScrapers(quotas);

        console.log('\n--- 🏁 RESULTADO DO TESTE REAL ---');
        console.log(`Total de produtos capturados: ${results.length}`);

        const counts = results.reduce((acc, p) => {
            acc[p.loja] = (acc[p.loja] || 0) + 1;
            return acc;
        }, {});

        console.log('Distribuição por loja:', counts);

        results.forEach(p => {
            console.log(`✅ [${p.loja.toUpperCase()}] ID: ${p.id} - Nome: ${p.nome}`);
        });

        if (results.length > 0) {
            console.log('\n✨ Teste concluído com sucesso! Os itens acima vieram do seu Drive.');
        } else {
            console.log('\n⚠️ Nenhum item encontrado no Drive ou todos já foram enviados recentemente.');
        }

    } catch (error) {
        console.error('❌ Erro no teste real:', error);
    }
}

runRealTest();
