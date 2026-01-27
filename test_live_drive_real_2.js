const { scrapeLiveByName } = require('./scrapers/live/nameScanner');
const { initBrowser } = require('./browser_setup');
require('dotenv').config();

(async () => {
    // Testing another item from the diagnostic output
    const item = {
        name: "macaquinho shorts fit green",
        id: "LIVE_16Vnoq",
        searchByName: true,
        driveUrl: "https://drive.google.com/uc?export=download&id=16Vnoqru1GXF42LLrILzfd94p6UWLKvF2",
        isFavorito: false
    };

    console.log(`🚀 Starting Live Drive Integration Test (Item 2)`);
    console.log(`📦 Item: ${item.name}`);

    const { browser, context } = await initBrowser();

    try {
        const products = await scrapeLiveByName(context, [item], 1);

        if (products && products.length > 0) {
            const p = products[0];
            console.log(`\n✅ SUCESSO! Produto capturado:`);
            console.log(`   Nome:  ${p.nome}`);
            console.log(`   ID:    ${p.id}`);
            console.log(`   Preço: R$ ${p.preco}`);
            console.log(`   URL:   ${p.url}`);
            console.log(`   Grade: ${p.cor_tamanhos}`);
        } else {
            console.log(`\n❌ FALHA! O produto não foi encontrado ou não foi capturado.`);
        }
    } catch (err) {
        console.error(`\n❌ ERRO DURANTE O TESTE:`, err.message);
    } finally {
        await browser.close();
        console.log(`\n🏁 Teste finalizado.`);
    }
})();
