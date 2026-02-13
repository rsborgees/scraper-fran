const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');

async function checkSearch() {
    const { browser, page } = await initBrowser();
    try {
        console.log('Navigating to Live home...');
        await page.goto('https://www.liveoficial.com.br/', { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(5000);

        const selectors = [
            'input.bn-search__input',
            'input[type="search"]',
            '.search-input',
            'input[placeholder*="Buscar"]'
        ];

        const results = await page.evaluate((sels) => {
            return sels.map(s => ({
                selector: s,
                found: !!document.querySelector(s),
                visible: document.querySelector(s) ? document.querySelector(s).offsetWidth > 0 : false
            }));
        }, selectors);

        console.log('Search selectors found:', JSON.stringify(results, null, 2));

        await page.screenshot({ path: 'debug/live_home_check.png' });
        console.log('Screenshot saved to debug/live_home_check.png');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

checkSearch();
