const { scrapeLive } = require('./scrapers/live/index');

async function test() {
    try {
        console.log('Running Live scraper test...');
        const results = await scrapeLive(2, true);
        console.log('Scraper results:', JSON.stringify(results, null, 2));
    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();
