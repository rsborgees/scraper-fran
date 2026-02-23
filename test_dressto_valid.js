const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
require('dotenv').config();

async function testValidId() {
    const { browser, context } = await initBrowser();
    try {
        const dressto = [{ id: '02083383', store: 'dressto' }];
        console.log(`Testing with valid ID: 02083383`);

        const results = await scrapeSpecificIdsGeneric(context, dressto, 'dressto', 1, { maxAgeHours: 0.01 });

        console.log('\n--- TEST RESULTS ---');
        console.log(`Found: ${results.products.length}`);
        results.products.forEach(p => console.log(`- ${p.id}: ${p.nome} (Price: ${p.precoAtual})`));

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

testValidId();
