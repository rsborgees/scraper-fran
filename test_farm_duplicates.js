const { scrapeFarm } = require('./scrapers/farm');

(async () => {
    console.log("Running Farm scraper with quota 5...");
    const products = await scrapeFarm(5);
    console.log("Scraped products:", products.length);
    products.forEach(p => console.log(`ID: ${p.id} - ${p.nome}`));
})();
