const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('Navigating to Live...');
    await page.goto('https://www.liveoficial.com.br', { waitUntil: 'domcontentloaded' });

    // Popup handling
    console.log('Handling popup...');
    await page.waitForTimeout(3000);
    const popupSelectors = [
        'button.sc-f0c9328e-3', // Specific button class from browser test
        'button[class*="close"]',
        '.modal-close',
        '[aria-label="Close"]',
        'button:has-text("×")',
        'button:has-text("Fechar")'
    ];

    for (const selector of popupSelectors) {
        const closeBtn = page.locator(selector);
        const count = await closeBtn.count();
        if (count > 0 && await closeBtn.first().isVisible()) {
            await closeBtn.first().click();
            console.log(`✅ Popup fechado usando: ${selector}`);
            await page.waitForTimeout(1000);
            break;
        }
    }

    const searchTerm = "macaquinho shorts fit green";
    console.log(`Searching for: ${searchTerm}`);

    const searchInput = page.locator('.bn-search__input');
    await searchInput.fill(searchTerm);
    await searchInput.press('Enter');

    console.log('Waiting for results...');
    await page.waitForTimeout(7000);

    const results = await page.evaluate((term) => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const searchWords = term.toLowerCase().split(' ').filter(w => w.length > 2);

        return links.map(a => {
            const url = a.href;
            const text = (a.innerText || '').toLowerCase().trim();
            const title = (a.title || '').toLowerCase().trim();

            let isProd = url.includes('/p/') || url.endsWith('/p') || url.match(/-\d+\/p$/);

            let score = 0;
            searchWords.forEach(w => {
                if (text.includes(w) || url.includes(w)) score++;
            });

            return { url, text, isProd, score };
        }).filter(l => l.isProd && l.score > 0);
    }, searchTerm);

    console.log('Results found:', results.length);
    if (results.length > 0) {
        results.slice(0, 5).forEach((r, i) => console.log(`[${i}] Score: ${r.score} | URL: ${r.url}`));
    }

    await browser.close();
}

test();
