const { initBrowser } = require('./browser_setup');
const { scrapeLiveByName } = require('./scrapers/live/nameScanner');

(async () => {
    const { browser, page } = await initBrowser();

    const driveItems = [
        { name: "Top Curve LIVE! branco", driveUrl: "https://example.com/top.jpg" },
        { name: "Shorts Pro Dryside branco", driveUrl: "https://example.com/shorts.jpg" }
    ];

    try {
        const results = await scrapeLiveByName(browser, driveItems, 2);
        console.log('\n✅ Scrape Results:');
        console.log(JSON.stringify(results, null, 2));

        if (results.length > 0) {
            console.log('\n📝 Formatted Name (Message):');
            console.log(results[0].nome);
        }

    } catch (err) {
        console.error("Error during scrapeLiveByName:", err);
    } finally {
        await browser.close();
    }
})();
