const { chromium } = require('playwright');

async function testApi() {
    console.log('🚀 Testing Live API Search...');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        const query = 'Legging';
        const apiUrl = `https://www.liveoficial.com.br/api/catalog_system/pub/products/search?ft=${query}`;
        console.log(`fetching: ${apiUrl}`);

        const response = await page.goto(apiUrl);
        const text = await response.text();

        try {
            const json = JSON.parse(text);
            console.log(`API returned ${json.length} items.`);
            if (json.length > 0) {
                console.log('First item:', json[0].productName);
                console.log('Link:', json[0].link);
                console.log('Items:', json[0].items.length); // colors/skus
            }
        } catch (e) {
            console.log('Response is not JSON:', text.substring(0, 200));
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

testApi();
