const { initBrowser } = require('./browser_setup');

async function debugZZMallLinks() {
    console.log('🧪 DEBUG: Link Inspection ZZMall...\n');

    const { browser, page } = await initBrowser();
    try {
        await page.goto('https://www.zzmall.com.br/c/promocao?q=:creation-time:categoryTreeLevel1:ROUPAS&influ=cupomdafran', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(url => url.includes('/p') || url.includes('/produto'));
        });

        console.log(`🔗 Found ${links.length} product links:`);
        links.slice(0, 20).forEach(l => console.log(l));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

debugZZMallLinks();
