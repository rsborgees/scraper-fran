const { scrapeLiveByName } = require('./scrapers/live/nameScanner');
const { initBrowser } = require('./browser_setup');
require('dotenv').config();

(async () => {
    // We'll use the first item from the diagnostic output
    const item = {
        name: "top curve live! shorts pro dryside",
        id: "LIVE_1l9b18",
        searchByName: true,
        driveUrl: "https://drive.google.com/uc?export=download&id=1l9b18m2uI77HTbii2G5OjpU-GvZpAjyH",
        isFavorito: false
    };

    console.log(`🚀 Starting Live Drive Integration Test`);
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
