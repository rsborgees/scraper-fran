const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { buildZzMallMessage } = require('./messageBuilder');

async function test() {
    const { browser, context } = await initBrowser();
    const driveItems = [
        { id: 'A5001506080001', store: 'zzmall' }
    ];

    try {
        console.log('Starting test scrape for ZZMall...');
        const { products, stats } = await scrapeSpecificIdsGeneric(context, driveItems, 'zzmall', 1);

        console.log('\n--- Result ---');
        console.log('Stats:', JSON.stringify(stats, null, 2));
        console.log('Products found:', products.length);

        if (products.length > 0) {
            const p = products[0];
            p.message = buildZzMallMessage(p);
            console.log('Product Name:', p.nome);
            console.log('Product ID:', p.id);
            console.log('Message Preview:', p.message.slice(0, 100) + '...');
        }
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await browser.close();
    }
}

test();
