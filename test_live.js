const { scrapeLive } = require('./scrapers/live');

async function test() {
    console.log('--- TESTE ISOLADO LIVE ---');
    try {
        const results = await scrapeLive(3);
        console.log('\n--- RESULTADOS DO TESTE ---');
        console.log(JSON.stringify(results, null, 2));
        console.log(`\nTotal capturado: ${results.length}`);
    } catch (error) {
        console.error('Erro no teste:', error);
    }
}

test();
