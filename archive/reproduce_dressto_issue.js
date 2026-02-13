const { scrapeDressTo } = require('./scrapers/dressto');
const { initBrowser } = require('./browser_setup');

async function test() {
    console.log('🧪 Testing Dress To Scraper...');
    const { browser, context } = await initBrowser();

    try {
        const products = await scrapeDressTo(5, context);
        console.log('\n📊 TEST RESULT:');
        console.log(`Found ${products.length} products.`);
        products.forEach((p, i) => {
            console.log(`${i + 1}. ${p.nome} - ID: ${p.id} - R$${p.precoAtual}`);
        });
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
    }
}

test();
