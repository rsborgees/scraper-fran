const { initBrowser } = require('./browser_setup');
const { parseProductKJU } = require('./scrapers/kju/index');

(async () => {
    const url = "https://www.kjubrasil.com/bone-tropical-floral-de-renda-me-leva-farm-verao-20242/";
    console.log(`🔍 Testing KJU Price Extraction on (Non-Promo): ${url}`);

    const { browser, page } = await initBrowser();

    try {
        const product = await parseProductKJU(page, url);

        if (product) {
            console.log("\n✅ Product Parsed Successfully:");
            console.log(`   Name: ${product.nome}`);
            console.log(`   Current Price (Should be ~41.30): ${product.precoAtual}`);
            console.log(`   Original Price: ${product.precoOriginal}`);
            console.log(`   Installments excluded? (Check if logic worked)`);
        } else {
            console.log("❌ Failed to parse product.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await browser.close();
    }
})();
