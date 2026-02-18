
const { runDailyDriveSyncJob } = require('./cronScheduler');
require('dotenv').config();

// Override scrapeSpecificIds to see what it's receiving
const farmScanner = require('./scrapers/farm/idScanner');
const originalScrape = farmScanner.scrapeSpecificIds;

farmScanner.scrapeSpecificIds = async (ctx, items, quota) => {
    console.log(`🕵️ [OVERRIDE] Received ${items.length} items for Farm.`);
    const match = items.find(i => i.id === '363187');
    if (match) {
        console.log('✅ ID 363187 IS in the list passed to scrapeSpecificIds!');
        console.log('Properties:', JSON.stringify(match, null, 2));
    } else {
        console.log('❌ ID 363187 IS NOT in the list passed to scrapeSpecificIds!');
        console.log('Sample IDs:', items.slice(0, 5).map(i => i.id));
    }
    return originalScrape(ctx, items, quota);
};

async function run() {
    console.log('🚀 Starting 5 AM Job Simulation...');
    await runDailyDriveSyncJob();
    console.log('🏁 Simulation complete.');
}

run();
