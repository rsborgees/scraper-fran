const { chromium } = require('playwright');

async function test() {
    console.log('🚀 Testing Live Search & Color Structure...');
    const browser = await chromium.launch({ headless: false }); // Headless false to see
    const page = await browser.newPage();

    try {
        // 1. Test Search
        const query = 'Legging';
        const searchUrl = `https://www.liveoficial.com.br/busca?q=${String(query)}`;
        console.log(`Navigating to: ${searchUrl}`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        // Check results
        const products = await page.locator('.product-item, .shelf-product-item, div[class*="product-item"]').count();
        console.log(`Found ${products} products on search page.`);

        if (products > 0) {
            // Click first product
            console.log('Clicking first product...');
            const firstProduct = page.locator('.product-item a, .shelf-product-item a').first();
            await firstProduct.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(3000);

            console.log(`Product Page: ${page.url()}`);

            // 2. Check Colors
            // Look for color swatches
            const colorSelectors = [
                '.product-color-selector li',
                '.sku-selector-container .sku-selector-item',
                'div[class*="color"] button',
                'div[class*="Color"] button'
            ];

            let colorEls = [];
            for (const sel of colorSelectors) {
                const count = await page.locator(sel).count();
                if (count > 0) {
                    console.log(`Found ${count} color candidates with selector: ${sel}`);
                    colorEls = page.locator(sel);
                    break;
                }
            }

            // 3. Check Sizes
            const sizeSelectors = [
                '.product-size-selector li',
                'div[class*="size"] button',
                'div[class*="dimension-Tamanho"]'
            ];

            let sizeEls = [];
            for (const sel of sizeSelectors) {
                const count = await page.locator(sel).count();
                if (count > 0) {
                    console.log(`Found ${count} size candidates with selector: ${sel}`);
                    sizeEls = page.locator(sel);
                    break;
                }
            }

        }

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await browser.close();
    }
}

test();
