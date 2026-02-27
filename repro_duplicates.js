const { scrapeKJU } = require('./scrapers/kju');
const { scrapeZZMall } = require('./scrapers/zzmall');
const { isDuplicate, loadHistory } = require('./historyManager');

async function testKJU() {
    console.log('--- TESTING KJU ---');
    const products = await scrapeKJU(1);
    if (products.length > 0) {
        const p = products[0];
        console.log(`Picked: ${p.nome} (ID: ${p.id})`);
        const history = loadHistory();
        if (history[p.id]) {
            console.log('✅ ID exists in history');
        } else {
            console.log('❌ ID NOT FOUND in history (THIS IS THE BUG)');
        }
    }
}

async function testZZMall() {
    console.log('\n--- TESTING ZZMALL ---');
    const products = await scrapeZZMall(1);
    if (products.length > 0) {
        const p = products[0];
        console.log(`Picked: ${p.nome} (ID: ${p.id})`);
        const history = loadHistory();
        if (history[p.id]) {
            console.log('✅ ID exists in history');

            console.log('Running again to see if it picks the same...');
            const products2 = await scrapeZZMall(1);
            if (products2.length > 0) {
                const p2 = products2[0];
                console.log(`Picked again: ${p2.nome} (ID: ${p2.id})`);
                if (p.id === p2.id) {
                    console.log('❌ PICKED THE SAME PIECE! (REPRODUCTION SUCCESSFUL)');
                } else {
                    console.log('✅ Picked a different piece.');
                }
            }
        } else {
            console.log('❌ ID NOT FOUND in history');
        }
    }
}

async function run() {
    await testKJU();
    await testZZMall();
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
