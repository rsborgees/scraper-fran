const { initBrowser } = require('./browser_setup');
require('dotenv').config();

async function checkRedirect() {
    const { browser, page } = await initBrowser();
    try {
        const id = '02083383';
        const url = `https://www.dressto.com.br/${id}?_q=${id}&map=ft&sc=1`;
        console.log(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);
        console.log(`Final URL: ${page.url()}`);
        console.log(`Title: ${await page.title()}`);

        const hasP = page.url().includes('/p');
        console.log(`Has /p: ${hasP}`);

        const pApi = require('./scrapers/dressto/parser');
        const data = await pApi.parseProductDressTo(page, url);
        console.log(`Parser Results:`, data);

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

checkRedirect();
