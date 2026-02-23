const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function dumpSearch() {
    const { browser, page } = await initBrowser();
    try {
        const id = '02083383';
        const url = `https://www.dressto.com.br/${id}?_q=${id}&map=ft&sc=1`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);
        const html = await page.content();
        fs.writeFileSync('dressto_search_result.html', html);
        await page.screenshot({ path: 'dressto_search_result.png' });
        console.log('Saved search results page.');
    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

dumpSearch();
