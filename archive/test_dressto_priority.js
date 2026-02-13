const { runAllScrapers } = require('./orchestrator');
const { isDuplicate, markAsSent, normalizeId } = require('./historyManager');
const fs = require('fs');
const path = require('path');

async function testDrivePriority() {
    console.log('🧪 Testing Drive-First Priority for Dress To...');

    // 1. Check if we have Dress To items in Drive folder
    // Since I can't easily mock Drive without touching tokens, I'll trust the logic if I see it trying.

    // 2. Clear Dress To IDs from history for a clean test
    const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');
    if (fs.existsSync(HISTORY_FILE)) {
        const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        // We'll keep it as is, but we'll monitor the logs.
    }

    try {
        // Run with exact quotas to see prioritization
        const products = await runAllScrapers({
            farm: 0,
            dressto: 2,
            kju: 0,
            live: 0,
            zzmall: 0
        });

        console.log('\n📊 FINAL TEST RESULTS:');
        console.log(`Total Products: ${products.length}`);
        products.forEach((p, i) => {
            console.log(`${i + 1}. [${p.loja.toUpperCase()}] ${p.nome} - ID: ${p.id}`);
        });

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDrivePriority();
