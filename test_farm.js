const { scrapeFarm } = require('./scrapers/farm');

async function test() {
    console.log('--- TESTE ISOLADO FARM (QUOTA: 84) ---');
    console.log('Este teste pode levar alguns minutos devido ao download de imagens e navegação em múltiplas categorias.');

    try {
        const startTime = Date.now();
        // O scraper agora gerencia as quotas internamente
        const results = await scrapeFarm(5);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('\n--- RESUMO DO TESTE FARM ---');
        console.log(`Duração total: ${duration}s`);
        console.log(`Total capturado: ${results.length}`);

        // Validação de categorias
        const stats = {};
        results.forEach(p => {
            stats[p.categoria] = (stats[p.categoria] || 0) + 1;
        });

        console.log('\nDistribuição por categoria:');
        console.table(stats);

        // Amostra dos primeiros 5 resultados para validar preço
        console.log('\nAmostra (primeiros 5):');
        console.log(JSON.stringify(results.slice(0, 5), null, 2));

    } catch (error) {
        console.error('Erro no teste FARM:', error);
    }
}

test();
