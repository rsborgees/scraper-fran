const { initBrowser } = require('./browser_setup');
const { parseProductLive } = require('./scrapers/live/index');

(async () => {
    const { browser, page } = await initBrowser();
    const url = 'https://www.liveoficial.com.br/top-curve-sense-pro-reflex-white-light-P006300BC08/p';

    try {
        console.log(`🔎 Checking details for: ${url}`);
        const product = await parseProductLive(page, url);
        console.log('\n📦 Product Data:');
        console.log(JSON.stringify(product, null, 2));

        // Also check raw title vs extracted name
        const rawTitle = await page.title();
        console.log(`\n📄 Page Title: ${rawTitle}`);

        const h1 = await page.evaluate(() => document.querySelector('h1')?.innerText);
        console.log(`🏷️ H1: ${h1}`);

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
})();
