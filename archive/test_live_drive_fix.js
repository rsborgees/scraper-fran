const { scrapeLiveByName } = require('./scrapers/live/nameScanner');
const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, context } = await initBrowser();

    // Use a real product name found on the site
    const items = [
        {
            name: "Bermuda Duo Collor Bynature Honeycomb Live! Icon Favorito",
            id: "LIVE_TEST_123",
            searchByName: true,
            driveUrl: "https://drive.google.com/uc?export=download&id=mock",
            isFavorito: false
        }
    ];

    try {
        console.log("🧪 Testing Fixed Live Name Search with Real-style data...");
        const products = await scrapeLiveByName(context, items, 1);

        console.log("\n📊 Results:");
        products.forEach((p, i) => {
            console.log(`[${i + 1}] Found: ${p.nome}`);
            console.log(`    ID: ${p.id}`);
            console.log(`    URL: ${p.url}`);
            console.log(`    Sizes: ${JSON.stringify(p.tamanhos)}`);
            console.log(`    Grade: ${p.cor_tamanhos}`);
        });

        if (products.length > 0) {
            console.log("\n✅ SUCESSO! Produto encontrado.");
        } else {
            console.log("\n❌ FALHA! Nenhum produto encontrado.");
        }
    } catch (err) {
        console.error("❌ Erro:", err);
    } finally {
        await browser.close();
    }
})();
