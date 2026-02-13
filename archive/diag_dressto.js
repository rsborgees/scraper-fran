const { initBrowser } = require('./browser_setup');
const path = require('path');
const fs = require('fs');

async function diag() {
    const { browser, page } = await initBrowser();
    const id = '02072689';
    const url = `https://www.dressto.com.br/${id}?_q=${id}&map=ft`;

    console.log(`Navigating to ${url}...`);
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(10000); // Wait for stabilization

        const screenshotPath = path.join(__dirname, 'debug', `diag_dressto_${id}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);

        const content = await page.evaluate(() => document.body.innerText.substring(0, 1000));
        console.log('Content snippet:', content.replace(/\n/g, ' '));

        const link = await page.evaluate(() => {
            const a = document.querySelector('a.vtex-product-summary-2-x-clearLink');
            return a ? a.href : 'NOT FOUND';
        });
        console.log('Link found:', link);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
    }
}

diag();
