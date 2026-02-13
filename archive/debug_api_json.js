const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function debugApiJson() {
    console.log('🔍 Debugging API JSON Structure...');
    const { browser, page } = await initBrowser();

    try {
        const url = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search?fq=C:/2000003/&O=OrderByReleaseDateDESC';
        console.log(`\n🔍 Fetching: ${url}`);

        const response = await page.goto(url);
        const text = await response.text();
        const json = JSON.parse(text);

        if (json && json.length > 0) {
            console.log('✅ JSON Sample (First item keys):', Object.keys(json[0]).join(', '));
            console.log('✅ Sample Data (First item):');
            const sample = {
                productId: json[0].productId,
                productName: json[0].productName,
                linkText: json[0].linkText,
                link: json[0].link,
                brand: json[0].brand
            };
            console.log(JSON.stringify(sample, null, 2));
            console.log('Type of link property:', typeof json[0].link);
        } else {
            console.log('❌ Empty JSON or invalid structure');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await browser.close();
    }
}

debugApiJson();
