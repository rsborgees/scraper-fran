
const { chromium } = require('playwright');
const path = require('path');

// Mock helpers
const collectedProducts = [];
const quota = 1;
const item = { id: '01332499', isFavorito: false };

(async () => {
    console.log(`\n🚙 REPRODUCING DRESSTO SEARCH for ID ${item.id}...`);

    const browser = await chromium.launch({
        headless: true, // Run visible to see what happens if possible, or use headless: true and screenshots
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    try {
        console.log('1. Navigating to Home...');
        await page.goto(`https://www.dressto.com.br`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2000);

        // Take initial screenshot
        await page.screenshot({ path: path.join(__dirname, 'debug_dressto_home_repro.png') });

        const searchInputSelector = '#downshift-0-input, input[placeholder="Digite sua busca"], input[placeholder*="buscar"]';
        const searchIconSelector = 'button[title="Buscar"], [class*="SearchCustom_icon"]';

        console.log('2. Checking Search Inputs...');
        let isInputVisible = await page.isVisible(searchInputSelector).catch(() => false);
        console.log(`   Input visible directly? ${isInputVisible}`);

        if (!isInputVisible) {
            console.log('   Clicking search icon...');
            if (await page.isVisible(searchIconSelector)) {
                await page.click(searchIconSelector);
                await page.waitForTimeout(1000);
                isInputVisible = await page.isVisible(searchInputSelector).catch(() => false);
                console.log(`   Input visible after icon click? ${isInputVisible}`);
            } else {
                console.log('   Search icon NOT found.');
            }
        }

        if (isInputVisible) {
            console.log(`3. Filling ID ${item.id}...`);
            await page.fill(searchInputSelector, item.id);
            await page.press(searchInputSelector, 'Enter');

            // Wait for results
            const productLinkSelector = 'a.vtex-product-summary-2-x-clearLink, a[href$="/p"]';
            console.log('4. Waiting for results...');

            try {
                await page.waitForSelector(productLinkSelector, { timeout: 15000 });
                console.log('   ✅ Result FOUND!');

                // Get the link
                const href = await page.getAttribute(productLinkSelector, 'href');
                console.log(`   Link: ${href}`);

            } catch (e) {
                console.log('   ❌ Timeout waiting for results.');
                await page.screenshot({ path: path.join(__dirname, 'debug_dressto_search_fail.png') });
            }
        } else {
            console.log('   ❌ Could not access search input.');
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    } finally {
        await browser.close();
    }
})();
