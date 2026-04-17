const { scrapeFarmSiteNovidades } = require('./scrapers/farm/siteNovidades');
require('dotenv').config();

async function test() {
    try {
        const products = await scrapeFarmSiteNovidades(10);
        console.log(`Encontrados ${products.length} produtos.`);
        products.forEach(p => console.log(`- ${p.nome} (${p.id})`));
    } catch (err) {
        console.error(err);
    }
}

test();
