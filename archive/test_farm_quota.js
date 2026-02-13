const { scrapeFarm } = require('./scrapers/farm/index');

(async () => {
    console.log("🧪 TESTING FARM QUOTA & FILTERS...");

    // Run with a small quota to be faster, but enough to see distribution
    // 12 items -> Expect ~9 dresses
    const products = await scrapeFarm(12);

    console.log("\n📊 REPORT:");
    console.log("Total Collected:", products.length);

    const categories = {};
    let kidsCount = 0;

    products.forEach(p => {
        categories[p.categoria] = (categories[p.categoria] || 0) + 1;

        // Paranoid check for kids
        if (/fabula|mini|kids|infantil/i.test(p.nome) || /fabula|mini|kids|infantil/i.test(p.url)) {
            kidsCount++;
            console.error(`❌ FOUND KIDS ITEM: ${p.nome} (${p.url})`);
        }
    });

    console.table(categories);

    if (kidsCount === 0) console.log("✅ No kids items found.");
    else console.log(`❌ Found ${kidsCount} kids items!`);

    const dressCount = categories['vestido'] || 0;
    const dressPercent = (dressCount / products.length) * 100;
    console.log(`👗 Dress Percentage: ${dressPercent.toFixed(1)}% (Target: 75%+)`);

    if (dressPercent >= 70) console.log("✅ Quota Passed!");
    else console.log("⚠️ Quota Warning (might be low sample size or avail issues)");

})();
