const { initBrowser } = require('./browser_setup');

async function test() {
    console.log('🚀 Debugging Live Search Interaction...');
    const { browser, context } = await initBrowser();
    const page = await browser.newPage();

    try {
        await page.goto('https://www.liveoficial.com.br', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);

        // Try to find search button/input
        const searchSelectors = [
            'button[class*="search"]',
            '.vtex-store-components-3-x-searchBarContainer button',
            'input[placeholder*="Buscar"]',
            'input[type="search"]'
        ];

        let found = false;
        for (const sel of searchSelectors) {
            if (await page.isVisible(sel)) {
                console.log(`Found search element: ${sel}`);
                if (sel.includes('button')) {
                    await page.click(sel);
                    await page.waitForTimeout(1000);
                } else {
                    await page.fill(sel, 'Legging');
                    await page.press(sel, 'Enter');
                    found = true;
                    break;
                }

                // If we clicked a button, maybe an input appeared?
                const inputSel = 'input[type="text"], input[type="search"]';
                if (await page.isVisible(inputSel)) {
                    await page.fill(inputSel, 'Legging');
                    await page.press(inputSel, 'Enter');
                    found = true;
                    break;
                }
            }
        }

        if (found) {
            console.log('Search submit. Waiting for results...');
            await page.waitForTimeout(5000);
            const url = page.url();
            console.log(`Current URL: ${url}`);
            await page.screenshot({ path: 'debug/live_search_result.png' });
        } else {
            console.log('❌ Could not interact with search.');
            await page.screenshot({ path: 'debug/live_home.png' });
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

test();
