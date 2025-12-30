/**
 * Sistema Multi-Loja de Scraping de Promoções
 * Total: 120 produtos
 * Lojas: FARM (84), Dress To (18), KJU (6), Live (6), ZZMall (6)
 */

const { runAllScrapers } = require('./orchestrator');

(async () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('  SISTEMA MULTI-LOJA DE PROMOÇÕES');
    console.log('═══════════════════════════════════════════════════\n');

    const allProducts = await runAllScrapers();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 RESULTADO FINAL');
    console.log('═══════════════════════════════════════════════════');
    console.log(`\nTotal de produtos capturados: ${allProducts.length}/120\n`);

    if (allProducts.length > 0) {
        console.log(JSON.stringify(allProducts, null, 2));
    } else {
        console.log('Nenhum produto capturado.');
    }

    console.log('\n✅ Scraping concluído!');
})();
