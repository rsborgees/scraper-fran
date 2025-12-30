const { scrapeDressTo } = require('./scrapers/dressto');

async function test() {
    console.log('--- TESTE ISOLADO DRESS TO (QUOTA: 3) ---');
    try {
        const results = await scrapeDressTo(3);
        console.log('\n--- RESULTADOS DO TESTE ---');
        console.log(JSON.stringify(results, null, 2));
    } catch (error) {
        console.error('Erro no teste Dress To:', error);
    }
}

test();
