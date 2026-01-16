const { chromium } = require('playwright');

async function test() {
    console.log('🚀 Testing Farm VTEX API...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const validId = '341926';
    const invalidId = '999999999';

    // VTEX Search API Pattern
    // ft = Full Text search
    const apiUrl = (id) => `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}`;

    try {
        console.log(`\n🔍 API Request for Valid ID: ${validId}`);
        const response1 = await page.goto(apiUrl(validId));
        const json1 = await response1.json().catch(() => null);

        if (json1 && json1.length > 0) {
            console.log(`   ✅ API Returned ${json1.length} results.`);
            console.log(`   📦 First Item: ${json1[0].productName} (ID: ${json1[0].productId})`);
            console.log(`   🔗 Link: ${json1[0].link}`);
        } else {
            console.log(`   ❌ API returned empty or invalid JSON:`, json1);
        }

        console.log(`\n🔍 API Request for Invalid ID: ${invalidId}`);
        const response2 = await page.goto(apiUrl(invalidId));
        const json2 = await response2.json().catch(() => null);

        if (json2 && json2.length === 0) {
            console.log(`   ✅ API correctly returned empty array.`);
        } else {
            console.log(`   ⚠️ API returned results for invalid ID:`, json2?.length);
        }

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await browser.close();
    }
}

test();
