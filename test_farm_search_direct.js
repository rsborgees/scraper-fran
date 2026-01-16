const { chromium } = require('playwright');

async function test() {
    console.log('🚀 Testing Direct Search URL...');
    const browser = await chromium.launch({ headless: true }); // Headless true for speed
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const validId = '341926';
    const invalidId = '999999999';

    try {
        // Test Valid ID
        console.log(`\n🔍 Testing Valid ID: ${validId}`);
        await page.goto(`https://www.farmrio.com.br/busca?q=${validId}`, { waitUntil: 'domcontentloaded' });

        // Wait for results
        const productSelector = '.vtex-product-summary-2-x-clearLink, .shelf-product-item a, a[href*="/p"]';
        try {
            await page.waitForSelector(productSelector, { timeout: 10000 });
            console.log('   ✅ Product selector found for Valid ID.');
            const href = await page.locator(productSelector).first().getAttribute('href');
            console.log(`   🔗 Found Link: ${href}`);
        } catch (e) {
            console.log('   ❌ Product selector NOT found for Valid ID.');
        }

        // Test Invalid ID
        console.log(`\n🔍 Testing Invalid ID: ${invalidId}`);
        await page.goto(`https://www.farmrio.com.br/busca?q=${invalidId}`, { waitUntil: 'domcontentloaded' });

        // Check for Not Found message
        const notFound = await page.evaluate(() => {
            const bodyText = document.body.innerText || '';
            return bodyText.includes('Ops, sua busca não foi encontrada') || bodyText.includes('OPS, NÃO ENCONTRAMOS');
        });

        if (notFound) {
            console.log('   ✅ Correctly detected "Not Found" for Invalid ID.');
        } else {
            console.log('   ❌ FAILED to detect "Not Found" for Invalid ID.');
            // Check if product selector exists (false positive?)
            const count = await page.locator(productSelector).count();
            console.log(`   found ${count} products.`);
        }

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await browser.close();
    }
}

test();
