const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');

async function test() {
    console.log('--- TESTANDO OTIMIZAÇÃO FAST-API ---');
    const { browser, context } = await initBrowser();

    // IDs que estavam esgotados nos logs do usuário
    const testItems = [
        { id: '355014', isFavorito: true }, // ESGOTADO
        { id: '355026', isFavorito: true }, // ESGOTADO
        { id: '354999', isFavorito: true }, // ESGOTADO
        { id: '355057', isFavorito: false }, // ESGOTADO
        { id: '355104', isFavorito: false }  // ESGOTADO
    ];

    const startTime = Date.now();
    try {
        const result = await scrapeSpecificIds(context, testItems, 5);
        const duration = (Date.now() - startTime) / 1000;

        console.log('\n--- RESULTADO DO TESTE ---');
        console.log(`Tempo total: ${duration}s`);
        console.log(`Itens capturados: ${result.products.length}`);
        console.log(`Stats: ${JSON.stringify(result.stats)}`);

    } catch (error) {
        console.error('Erro no teste:', error);
    } finally {
        await browser.close();
    }
}

test();
