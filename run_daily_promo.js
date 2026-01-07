const { getPromoSummary } = require('./scrapers/farm/promoScanner');

async function run() {
    console.log('⏳ Analisando site para gerar copy...');
    const copy = await getPromoSummary();
    console.log('\n 👇 COPY GERADA PARA APROVAÇÃO 👇\n');
    console.log(copy);
    console.log('\n 👆 -------------------------- 👆\n');
}

run();
