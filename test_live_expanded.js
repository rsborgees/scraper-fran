const { scrapeLive } = require('./scrapers/live/index');

async function test() {
    try {
        console.log('Running expanded Live scraper test...');
        const results = await scrapeLive(10, true);
        console.log('Scraper results found:', results.length);
        results.forEach(p => {
            console.log(`- ${p.nome} | Cat: ${p.categoria} | Type: ${p.type}`);
        });
    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();
