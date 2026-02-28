const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');

async function verifyBazarPropagation() {
    console.log('🚀 Starting Bazar Propagation Verification...');
    const { browser, context } = await initBrowser();

    try {
        // Test Case 1: Farm Scraper
        console.log('\n--- Testing Farm Scraper ---');
        const farmItem = {
            id: '347072',
            store: 'farm',
            bazar: true, // Flagged as bazar in Drive
            isFavorito: true
        };

        const farmResult = await scrapeSpecificIds(context, [farmItem], 1);
        const farmProd = farmResult.products[0];

        if (farmProd) {
            console.log(`Product: ${farmProd.nome}`);
            console.log(`Bazar Flag (bazar): ${farmProd.bazar}`);
            console.log(`Bazar Flag (isBazar): ${farmProd.isBazar}`);
            if (farmProd.bazar === true && farmProd.isBazar === true) {
                console.log('✅ Farm Bazar Propagation: OK');
            } else {
                console.log('❌ Farm Bazar Propagation: FAILED');
            }
        }

        // Test Case 2: Generic Scraper (e.g., Dress To)
        console.log('\n--- Testing Generic Scraper (Dress To) ---');
        const dressItem = {
            id: '01332394',
            store: 'dressto',
            bazar: true,
            isFavorito: true,
            driveId: '01332394'
        };

        const dressResult = await scrapeSpecificIdsGeneric(context, [dressItem], 'dressto', 1);
        const dressProd = dressResult.products[0];

        if (dressProd) {
            console.log(`Product: ${dressProd.nome}`);
            console.log(`Bazar Flag (bazar): ${dressProd.bazar}`);
            console.log(`Bazar Flag (isBazar): ${dressProd.isBazar}`);
            if (dressProd.bazar === true && dressProd.isBazar === true) {
                console.log('✅ Generic Bazar Propagation: OK');
            } else {
                console.log('❌ Generic Bazar Propagation: FAILED');
            }
        }

    } catch (error) {
        console.error('Error during verification:', error);
    } finally {
        await browser.close();
    }
}

verifyBazarPropagation();
