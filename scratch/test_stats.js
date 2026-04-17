const { getSupabaseStats } = require('../cronScheduler');
const { getPromoSummary } = require('../scrapers/farm/promoScanner');

async function test() {
    console.log('--- Testing getSupabaseStats ---');
    const stats = await getSupabaseStats();
    console.log('Stats:', JSON.stringify(stats, null, 2));
    
    if (stats.total >= 160) {
        console.log('BLOCKED: Total is >= 160');
    } else {
        console.log('PROCEED: Total is < 160');
    }
}

test();
