const { scrapeZZMall } = require('./scrapers/zzmall');
const { initBrowser } = require('./browser_setup');

async function test() {
    console.log('Testing ZZMall scraper...');
    const { browser, context } = await initBrowser();
    try {
        const products = await scrapeZZMall(3, context);
        console.log('Final Products:', JSON.stringify(products, null, 2));
        console.log('Total gathered:', products.length);
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await browser.close();
    }
}

test();
