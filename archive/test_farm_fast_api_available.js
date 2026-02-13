const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');

async function test() {
    console.log('--- TESTANDO OTIMIZAÇÃO FAST-API (DISPONÍVEL) ---');
    const { browser, context } = await initBrowser();

    const testItems = [
        { id: '321102_42980', isFavorito: true } // FORBIDDEN (Bolsa)
    ];

    const startTime = Date.now();
    try {
        const result = await scrapeSpecificIds(context, testItems, 1);
        const duration = (Date.now() - startTime) / 1000;

        console.log('\n--- RESULTADO DO TESTE ---');
        console.log(`Tempo total: ${duration}s`);
        console.log(`Itens capturados: ${result.products.length}`);
        if (result.products.length > 0) {
            const p = result.products[0];
            console.log(`Produto: ${p.nome}`);
            console.log(`Preço: R$${p.precoOriginal} -> R$${p.precoAtual}`);
            console.log(`Tamanhos: ${p.tamanhos.join(', ')}`);
            console.log(`URL Imagem: ${p.imageUrl}`);
        }
        console.log(`Stats: ${JSON.stringify(result.stats)}`);

    } catch (error) {
        console.error('Erro no teste:', error);
    } finally {
        await browser.close();
    }
}

test();
