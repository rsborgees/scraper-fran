const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();
    try {
        const query = "macaquinho shorts fit green";
        console.log(`🔍 Buscando por: "${query}"`);

        await page.goto('https://www.liveoficial.com.br', { waitUntil: 'domcontentloaded' });

        const searchInputSelector = 'input.bn-search__input, .search-input, input[type="search"]';
        const searchInput = page.locator(searchInputSelector).first();
        await searchInput.click();
        await searchInput.fill('');
        await searchInput.type(query, { delay: 30 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(8000);

        const candidates = await page.evaluate((name) => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            return links.filter(a => {
                const href = a.href.toLowerCase();
                return (href.includes('/p') || href.includes('/p/')) &&
                    !['/carrinho', '/login', '/checkout', '/conta', '/atendimento'].some(s => href.includes(s));
            }).map(a => {
                const text = (a.innerText || '').toLowerCase().trim();
                const target = name.toLowerCase().trim();
                let score = 0;
                if (text === target) score += 100;
                else if (text.includes(target)) score += 50;
                else if (target.includes(text) && text.length > 5) score += 40;

                const targetWords = target.split(' ').filter(w => w.length > 2);
                targetWords.forEach(w => { if (text.includes(w)) score += 20; });

                return { url: a.href, score, text };
            }).sort((a, b) => b.score - a.score).slice(0, 10);
        }, query);

        console.log('\n📊 Candidatos encontrados:');
        console.log(JSON.stringify(candidates, null, 2));

    } finally {
        await browser.close();
    }
})();
