const { scrapeDressTo } = require('./scrapers/dressto');
const { buildDressMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
const { initBrowser } = require('./browser_setup');

async function runFinalDressTo() {
    console.log('👗 Iniciando Scraper Final Dress To (5 itens)...');
    const { context, browser } = await initBrowser();

    try {
        const products = await scrapeDressTo(5, context);
        console.log(`✅ Capturados ${products.length} produtos.`);

        products.forEach(p => {
            p.message = buildDressMessage(p);
        });

        if (products.length > 0) {
            await sendToWebhook(products);
            console.log('✅ Envios concluídos!');
        } else {
            console.log('⚠️ Nenhum produto encontrado.');
        }

    } catch (error) {
        console.error('❌ Erro no scraper final:', error.message);
    } finally {
        await browser.close();
    }
}

runFinalDressTo();
