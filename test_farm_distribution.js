
const { scrapeFarm } = require('./scrapers/farm/index');

async function testQuota() {
    console.log('🧪 TESTING FARM QUOTA DISTRIBUTION (Quota: 7)');

    try {
        const products = await scrapeFarm(7, true);

        console.log('\n----------------------------------------');
        console.log(`📊 RESULTS (Total: ${products.length}/7)`);
        console.log('----------------------------------------');

        const distribution = {};
        products.forEach(p => {
            const cat = p.categoria || 'outros';
            distribution[cat] = (distribution[cat] || 0) + 1;
        });

        Object.entries(distribution).forEach(([cat, count]) => {
            const pct = ((count / products.length) * 100).toFixed(1);
            console.log(`${cat.padEnd(15)}: ${count} (${pct}%)`);
        });

        const dressCount = distribution['Vestidos'] || 0;
        const dressPct = (dressCount / products.length);

        if (products.length !== 7) {
            console.error(`❌ FAILED: Wanted 7 items, got ${products.length}`);
        } else if (dressPct < 0.6) {
            console.warn(`⚠️ WARNING: Dress percentage low (${(dressPct * 100).toFixed(1)}%). Expected ~75%`);
        } else {
            console.log('✅ SUCCESS: Quota met and distribution looks correct.');
        }

    } catch (e) {
        console.error('❌ CRITICAL ERROR:', e);
    }
}

testQuota();
