const { setDynamicGoals, getRemainingQuotas } = require('./dailyStatsManager');

function test(poolSize) {
    console.log(`\n🧪 Testing with pool size: ${poolSize}`);
    const dynamicDressGoal = Math.max(15, Math.ceil(poolSize * 0.15));
    console.log(`   Expected goal (15%): ${dynamicDressGoal}`);
    
    setDynamicGoals({ stores: { dressto: dynamicDressGoal } });
    
    const remaining = getRemainingQuotas();
    console.log(`   Remaining for DRESSTO: ${remaining.stores.dressto}`);
}

test(77);  // Current real size
test(120); // User example
test(200); // 15% = 30
test(50);  // 15% = 7.5 -> 15 (min floor)
