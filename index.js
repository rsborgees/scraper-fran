/**
 * Sistema Multi-Loja de Scraping de Promoções
 * Total: 12 produtos
 * Lojas: FARM (7), Dress To (2), KJU (1), Live (1), ZZMall (1)
 */

const { runAllScrapers } = require('./orchestrator');
const { sendToWebhook } = require('./cronScheduler');

(async () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('  SISTEMA MULTI-LOJA DE PROMOÇÕES');
    console.log('═══════════════════════════════════════════════════\n');

    const allProducts = await runAllScrapers();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 RESULTADO FINAL');
    console.log('═══════════════════════════════════════════════════');
    console.log(`\nTotal de produtos capturados: ${allProducts.length}/12\n`);

    if (allProducts.length > 0) {
        console.log(`Enviando ${allProducts.length} produtos para o webhook...`);
        await sendToWebhook(allProducts);
    } else {
        console.log('Nenhum produto capturado.');
    }

    console.log('\n✅ Scraping concluído!');
})();
