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

        console.log('Waiting for results...');
        await page.waitForTimeout(8000);

        await page.screenshot({ path: 'debug/live_search_debug_results.png', fullPage: true });
        console.log('Screenshot saved to debug/live_search_debug_results.png');

        const content = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/p"]')).map(a => a.href);
            return {
                url: window.location.href,
                linksCount: links.length,
                firstLinks: links.slice(0, 5)
            };
        });
        console.log('Page Data:', content);

    } finally {
        await browser.close();
    }
})();
