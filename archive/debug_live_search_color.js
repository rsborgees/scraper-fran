const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();

    // Exact queries to test
    const queries = [
        "top curve live branco",
        "top curve live! branco",
        "top curve live",
        "shorts pro dryside branco"
    ];

    try {
        await page.goto('https://www.liveoficial.com.br/outlet', { waitUntil: 'domcontentloaded' });

        await page.evaluate(() => {
            const closeSelectors = ['button.sc-f0c9328e-3.dnwgCm', 'button[class*="close"]', '.modal-close', '[aria-label="Close"]'];
            closeSelectors.forEach(sel => { document.querySelectorAll(sel).forEach(el => el.click()); });
        });

        for (const query of queries) {
            console.log(`\n🔎 Testing Search: "${query}"`);

            const searchInputSelector = 'input.bn-search__input, .search-input, input[type="search"]';
            const searchInput = page.locator(searchInputSelector).first();
            await searchInput.click();
            await page.waitForTimeout(500);
            await searchInput.fill('');
            await searchInput.type(query, { delay: 50 }); // Slower typing
            await page.waitForTimeout(1000);
            await page.keyboard.press('Enter');

            await page.waitForTimeout(5000); // Wait for results

            // Check results
            const results = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                const productLinks = links.filter(a => a.href.includes('/p/') || a.href.match(/-[a-zA-Z0-9]{4,}\/p(\?|$)/));
                return productLinks.slice(0, 5).map(a => ({
                    title: a.innerText.trim(),
                    url: a.href
                }));
            });

            if (results.length > 0) {
                console.log(`   ✅ Found ${results.length} results.`);
                results.forEach(r => console.log(`      - ${r.title} (${r.url})`));
            } else {
                console.log(`   ❌ No results found.`);
            }
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await browser.close();
    }
})();
