const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function testDresstoScanner() {
    const { browser, context } = await initBrowser();
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        const dressto = allDriveItems.filter(i => i.store === 'dressto').slice(0, 5);

        console.log(`Testing with IDs: ${dressto.map(i => i.id).join(', ')}`);

        const results = await scrapeSpecificIdsGeneric(context, dressto, 'dressto', 5, { maxAgeHours: 0.01 }); // 0.01 to bypass duplicate check correctly

        console.log('\n--- TEST RESULTS ---');
        console.log(`Found: ${results.products.length}`);
        results.products.forEach(p => console.log(`- ${p.id}: ${p.nome} (Price: ${p.precoAtual})`));
        console.log('Stats:', results.stats);

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

testDresstoScanner();
