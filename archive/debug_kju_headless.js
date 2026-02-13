const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');

async function debugKJU() {
    process.env.HEADLESS = 'true';
    const { browser, page } = await initBrowser();

    page.on('console', msg => console.log(`[CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`));
    page.on('requestfailed', request => console.log(`[REQ FAIL] ${request.url()}: ${request.failure().errorText}`));

    try {
        const url = 'https://www.kjubrasil.com/?ref=7B1313';
        console.log(`Navigating to ${url}...`);

        const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        console.log(`Status: ${response.status()}`);
        console.log(`Title: ${await page.title()}`);

        const content = await page.content();
        fs.writeFileSync('kju_debug_content.html', content);
        console.log(`Content saved to kju_debug_content.html (Length: ${content.length})`);

        await page.screenshot({ path: 'kju_debug_full.png', fullPage: true });
        console.log(`Screenshot saved to kju_debug_full.png`);

    } catch (e) {
        console.error(`Error: ${e.message}`);
    } finally {
        await browser.close();
    }
}

debugKJU();
