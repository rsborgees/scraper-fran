const { initBrowser } = require('./browser_setup');
const { parseProductLive } = require('./scrapers/live/index');

(async () => {
    const { browser, page } = await initBrowser();

    try {
        const url2 = 'https://www.liveoficial.com.br/top-curve-live-white-black-P006300BC04/p';
        console.log(`🔎 Checking details for URL 2: ${url2}`);
        const product2 = await parseProductLive(page, url2);
        console.log(JSON.stringify(product2, null, 2));

        console.log('\n🔎 Searching specifically for "Top Sense Pro"...');
        const searchUrl = 'https://www.liveoficial.com.br/busca?q=Top+Sense+Pro';
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const searchResults = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            const productLinks = links.filter(a => a.href.includes('/p/') || a.href.match(/-[a-zA-Z0-9]{4,}\/p(\?|$)/));
            return productLinks.slice(0, 5).map(a => ({
                title: a.innerText.trim(),
                url: a.href
            }));
        });
        console.log('Search Results for "Top Sense Pro":');
        console.log(JSON.stringify(searchResults, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
})();
