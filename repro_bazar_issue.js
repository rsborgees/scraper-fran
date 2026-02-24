const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const path = require('path');

async function test() {
    const { browser, page } = await initBrowser();
    const id = '355028';

    // Attempt multiple patterns to find the exact URL if needed, 
    // but usually search API is better to get the link.
    // For reproduction, we can just use the search API directly if we don't have the link.

    const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}`;

    try {
        console.log(`Searching for ID: ${id}`);
        await page.goto(apiUrl);
        const content = await page.evaluate(() => document.body.innerText);
        const json = JSON.parse(content);

        if (json && json.length > 0) {
            const productData = json[0];
            const url = productData.link;
            console.log(`Found URL: ${url}`);

            const product = await parseProduct(page, url);
            console.log('\n--- Parse Result ---');
            console.log(JSON.stringify(product, null, 2));
        } else {
            console.log('Product not found via API');
        }
    } catch (e) {
        console.error('Error during test:', e);
    } finally {
        await browser.close();
    }
}

test();
