const { initBrowser } = require('../../browser_setup');

async function testVtexDeep() {
    console.log('🚀 Testing Vtex Deep Objects...');
    const { browser, page } = await initBrowser();

    // Bazar URL
    const url = 'https://www.farmrio.com.br/top-estampado-coqueiral-coqueiral_galao_preto-357793-51202/p?brand=farm';

    try {
        console.log(`Testing URL: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const data = await page.evaluate(() => {
            const result = {};

            // 1. Runtime
            if (window.__RUNTIME__) {
                result.runtime_categories = window.__RUNTIME__.categories; // Check if this exists
                result.runtime_product = window.__RUNTIME__.product;
                result.runtime_route = window.__RUNTIME__.route;
            }

            // 2. Vtex
            if (window.vtex) {
                result.vtex_categoryName = window.vtex.categoryName;
                result.vtex_departmentName = window.vtex.departmentName;
            }

            // 3. SkuJson
            if (window.skuJson) {
                result.skuJson_name = window.skuJson.name;
                result.skuJson_cat = window.skuJson_categoryId; // guessed
            }

            // 4. DataLayer Full Scan for "Bazar"
            if (window.dataLayer) {
                result.dataLayer_matches = window.dataLayer.filter(e => JSON.stringify(e).toLowerCase().includes('bazar'));
            }

            return result;
        });

        console.log('---------------------------------------------------');
        console.log('Deep Scan Result:');
        console.log(JSON.stringify(data, null, 2));
        console.log('---------------------------------------------------');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testVtexDeep();
