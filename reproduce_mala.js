const { parseProduct } = require('./scrapers/farm/parser');
const { initBrowser } = require('./browser_setup');

async function testUrl(page, url) {
    console.log(`\n--- Testing: ${url} ---`);
    const result = await parseProduct(page, url);
    if (result) {
        console.log('✅ Success:');
        console.log(`   Name: ${result.nome}`);
        console.log(`   Original: R$ ${result.precoOriginal}`);
        console.log(`   Current: R$ ${result.precoAtual}`);
        if (result.debugInfo) {
            console.log('   Debug Info:', JSON.stringify(result.debugInfo, null, 2));
        }
    } else {
        console.log('❌ Failed to parse.');
    }
}

(async () => {
    const { browser, page } = await initBrowser();
    const url = 'https://www.farmrio.com.br/mala-f-light-global-blooming-100l-blooming-black-355135-55343/p?brand=farmetc&utm_campaign=7B1313';

    try {
        await testUrl(page, url);
    } catch (err) {
        console.error('Test Error:', err);
    } finally {
        await browser.close();
    }
})();
