const { scrapeLive } = require('./scrapers/live');

async function test() {
    console.log('--- TESTE ISOLADO LIVE (COM BYPASS DE DUPLICATAS) ---');
    try {
        // Pede 6 produtos e IGNORA DUPLICATAS (true) para testar conjuntos
        const results = await scrapeLive(6, true);
        console.log('\n--- RESULTADOS DO TESTE ---');
        console.log(JSON.stringify(results, null, 2));
        console.log(`\nTotal capturado: ${results.length}`);
    } catch (error) {
        console.error('Erro no teste:', error);
    }
}

test();
