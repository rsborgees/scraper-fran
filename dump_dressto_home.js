const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function dumpHtml() {
    const { browser, page } = await initBrowser();
    try {
        await page.goto('https://www.dressto.com.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);
        const html = await page.content();
        fs.writeFileSync('dressto_home.html', html);
        await page.screenshot({ path: 'dressto_home.png', fullPage: true });
        console.log('HTML and screenshot saved.');
    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

dumpHtml();
