const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();
    try {
        await page.goto('https://www.liveoficial.com.br', { waitUntil: 'domcontentloaded' });

        const searchInputSelector = 'input.bn-search__input, .search-input, input[type="search"]';
        await page.waitForSelector(searchInputSelector);
        const searchInput = page.locator(searchInputSelector).first();
        await searchInput.click();
        await searchInput.fill('top curve');
        await page.keyboard.press('Enter');

        console.log('Waiting for search results...');
        await page.waitForTimeout(8000);

        const results = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a'));
            return allLinks.filter(a => a.innerText.toLowerCase().includes('top curve'))
                .map(a => ({
                    text: a.innerText,
                    href: a.href,
                    html: a.outerHTML.substring(0, 100)
                }));
        });

        console.log('Found Top Curve Links:', JSON.stringify(results, null, 2));
        await page.screenshot({ path: 'debug/live_final_search_check.png' });

    } finally {
        await browser.close();
    }
})();
