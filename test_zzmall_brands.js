const { scrapeZZMall } = require('./scrapers/zzmall/index');
const { closeBrowser } = require('./browser_setup');

(async () => {
    console.log('🚀 Iniciando teste ISOLADO do ZZMALL (Estratégia de Marcas)...');
    try {
        // Pedimos 4 produtos só para validar navegação e coleta
        const products = await scrapeZZMall(4);
        console.log('\n📊 RELATÓRIO FINAL DO TESTE:');
        console.log(`Total coletado: ${products.length}`);
        products.forEach(p => console.log(`- [${p.id}] ${p.nome} | ${p.loja} | R$${p.precoAtual}`));
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
    // Force exit
    process.exit(0);
})();
