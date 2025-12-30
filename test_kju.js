const { scrapeKJU } = require('./scrapers/kju');

async function test() {
    console.log('--- TESTE ISOLADO KJU ---');
    try {
        // Executa o scraper com uma quota de 3 produtos para ser rápido
        const results = await scrapeKJU(3);

        console.log('\n--- RESULTADOS DO TESTE ---');
        console.log(JSON.stringify(results, null, 2));
        console.log(`\nTotal capturado: ${results.length}`);
    } catch (error) {
        console.error('Erro no teste:', error);
    }
}

test();
