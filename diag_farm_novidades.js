const { scrapeFarmSiteNovidades } = require('./scrapers/farm/siteNovidades');
require('dotenv').config();

async function test() {
    console.log('--- DIAGNOSTIC: SCRAPE FARM SITE NOVIDADES ---');
    try {
        const products = await scrapeFarmSiteNovidades(5); // Request 5 to see what we find
        console.log(`\nFound ${products.length} products:`);
        products.forEach(p => {
            console.log(`- [${p.id}] ${p.nome} (R$ ${p.precoAtual}) - isSiteNovidade: ${p.isSiteNovidade}`);
        });
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
