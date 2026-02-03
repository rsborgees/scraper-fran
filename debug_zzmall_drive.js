const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
require('dotenv').config();

(async () => {
    const { browser, context } = await initBrowser();

    // Mock Drive Item
    const driveItems = [
        {
            id: '1902701660001', // Real ZZMall ID
            driveUrl: 'https://drive.google.com/uc?export=download&id=MOCK_FILE_ID',
            isFavorito: true,
            store: 'zzmall'
        }
    ];

    console.log('🚀 Testing ZZMall Drive-First with ID: 1902701660001');

    try {
        const result = await scrapeSpecificIdsGeneric(context, driveItems, 'zzmall', 1);
        console.log('\n📊 Result:');
        console.log(JSON.stringify(result, null, 2));

        if (result.products.length > 0) {
            console.log('\n✅ Product found!');
            console.log(`Name: ${result.products[0].nome}`);
            console.log(`ImagePath: ${result.products[0].imagePath}`);
        } else {
            console.log('\n❌ Product not found or failed to parse.');
        }
    } catch (error) {
        console.error('❌ Error during test:', error);
    } finally {
        await browser.close();
    }
})();
