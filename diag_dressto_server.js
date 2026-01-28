const { scrapeDressTo } = require('./scrapers/dressto');
const { initBrowser } = require('./browser_setup');
require('dotenv').config();

(async () => {
    console.log('🔍 [DIAGNOSTIC] Testando Scraper DressTo...');

    // Simulando ambiente Headless se estiver no Easypanel
    // No .env local, pode estar false, mas no Easypanel geralmente é true
    console.log(`📡 HEADLESS MODE: ${process.env.HEADLESS}`);

    const { browser, context } = await initBrowser();

    try {
        console.log('👗 Rodando scrapeDressTo(2)...');
        const results = await scrapeDressTo(2, context);

        console.log('\n==================================================');
        console.log(`✅ RESULTADO: ${results.length} itens capturados.`);
        console.log('==================================================');

        if (results.length > 0) {
            results.forEach((p, i) => {
                console.log(`\n[${i + 1}] PRODUTO: ${p.nome}`);
                console.log(`    💰 Preço: R$ ${p.precoAtual}`);
                console.log(`    📏 Categoria: ${p.categoria}`);
                console.log(`    🔗 URL: ${p.url}`);
            });
        } else {
            console.log('\n❌ Nenhum item capturado. O scraper não conseguiu encontrar produtos ou todos foram filtrados como duplicados.');

            // Verificação extra de duplicatas
            console.log('\n🕵️ Verificando histórico...');
            const { isDuplicate, normalizeId } = require('./historyManager');
            // ID de exemplo (precisaria rodar o scraper para ver quais IDs ele tentou)
        }

    } catch (err) {
        console.error('❌ Erro durante o diagnóstico:', err.message);
    } finally {
        await browser.close();
        console.log('\n🏁 Diagnóstico finalizado.');
    }
})();
