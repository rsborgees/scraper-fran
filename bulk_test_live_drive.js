const { initBrowser } = require('./browser_setup');
const { scrapeLiveByName } = require('./scrapers/live/nameScanner');

(async () => {
    const { browser, page } = await initBrowser();

    // Real names found in Drive
    const driveItems = [
        { name: "Top LIVE! Hydefit® Adaptiv", driveUrl: "https://example.com/1.jpg" },
        { name: "Macaquinho shorts fit Green live", driveUrl: "https://example.com/2.jpg" },
        { name: "Top Curve LIVE! White Light Shorts Fit LIVE! Icon Branco", driveUrl: "https://example.com/3.jpg" },
        { name: "Top Curve LIVE! branco shorts pro dryside branco", driveUrl: "https://example.com/4.jpg" }
    ];

    try {
        console.log(`🚀 Starting bulk test for ${driveItems.length} items...`);
        // Test with a higher quota to allow all to process
        const results = await scrapeLiveByName(browser, driveItems, 10);

        console.log('\n--- Final Comparison ---');
        driveItems.forEach(item => {
            const result = results.find(r => r.nome.toLowerCase().includes(item.name.toLowerCase().split(' ')[0])); // Loose match for log
            if (result && !result.nome.includes('Não encontrado')) {
                console.log(`✅ MATCHED: "${item.name}" -> ${result.url}`);
            } else {
                console.log(`❌ FAILED: "${item.name}"`);
            }
        });

        console.log('\n📦 Full Results Data:');
        console.log(JSON.stringify(results, null, 2));

    } catch (err) {
        console.error("Error during bulk test:", err);
    } finally {
        await browser.close();
    }
})();
