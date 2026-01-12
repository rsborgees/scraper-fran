
const { scrapeLive } = require('./scrapers/live');

(async () => {
    try {
        console.log('--- TEST LIVE SCRAPER ---');
        const products = await scrapeLive(6, true); // ignoreDuplicates = true
        console.log('--- OUTPUT ---');
        console.log(JSON.stringify(products, null, 2));
    } catch (e) {
        console.error(e);
    }
})();
