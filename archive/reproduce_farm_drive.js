const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');

async function test() {
    console.log('🚀 Starting reproduction test...');
    const { browser, context } = await initBrowser();
    try {
        // ID known to exist in history (so presumably valid product)
        const testId = '341926';

        const driveItems = [{
            id: testId,
            driveUrl: 'https://drive.google.com/uc?export=download&id=TEST_FILE_ID',
            isFavorito: true, // Force to bypass duplicate check for testing purposes? Or simulate normal flow?
            // If I set isFavorito: true, it bypasses isDuplicate check in idScanner line 139?
            // "const isDup = isDuplicate(normalizeId(finalProduct.id), { force: item.isFavorito }, finalProduct.preco);"
            // Yes.
            isSet: false
        }];

        console.log(`Testing with ID: ${testId}`);

        const result = await scrapeSpecificIds(context, driveItems, 5);
        console.log('Result:', JSON.stringify(result, null, 2));

        if (result.products.length === 0 && result.stats.duplicates === 0) {
            console.error('❌ Failed to collect product (Not found or Error).');
        } else {
            console.log('✅ TEST PASSED: Product successfully found (collected or duplicate).');
            if (result.stats.duplicates > 0) console.log('   (Item was found but skipped as duplicate, which is expected behavior)');
        }

    } catch (e) {
        console.error('❌ Test failed with error:', e);
    } finally {
        await browser.close();
    }
}

test();
