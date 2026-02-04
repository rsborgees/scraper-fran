const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();
    const query = "top curve live branco";

    try {
        console.log(`🔎 Searching for: "${query}"`);
        const searchUrl = `https://www.liveoficial.com.br/busca?q=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const results = await page.evaluate(() => {
            // Updated selector to find products precisely
            const cards = Array.from(document.querySelectorAll('div[class*="product-summary"], div[class*="summaryContainer"], .vtex-product-summary-2-x-container'));
            return cards.slice(0, 5).map(card => {
                const links = Array.from(card.querySelectorAll('a[href*="/p"]'));
                const imgs = Array.from(card.querySelectorAll('img'));
                return {
                    text: card.innerText.replace(/\n/g, ' ').trim(),
                    href: links.length > 0 ? links[0].href : null,
                    images: imgs.map(img => ({ alt: img.alt, src: img.src })),
                    html: card.outerHTML.substring(0, 1000)
                };
            });
        });

        console.log('Search Results:');
        console.log(JSON.stringify(results, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
})();
