const { parseProduct } = require('./scrapers/farm/parser');
const { initBrowser } = require('./browser_setup');

async function getProductLink(page, id) {
    const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}`;
    await page.goto(apiUrl);
    const text = await page.evaluate(() => document.body.innerText);
    try {
        const json = JSON.parse(text);
        if (json && json.length > 0) return json[0].link;
    } catch (e) { }
    return null;
}

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

    // IDs from history that might be in stock
    const ids = ['351041', '351515', '351525', '347079'];

    try {
        for (const id of ids) {
            console.log(`\n🔎 Getting link for ID: ${id}`);
            const link = await getProductLink(page, id);
            if (link) {
                await testUrl(page, link);
            } else {
                console.log(`⚠️ Link not found for ID: ${id}`);
            }
        }
    } catch (err) {
        console.error('Test Error:', err);
    } finally {
        await browser.close();
    }
})();
