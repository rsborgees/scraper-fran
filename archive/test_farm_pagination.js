const { scrapeFarm } = require('./scrapers/farm/index');
const { closeBrowser } = require('./browser_setup');

(async () => {
    // Aumentamos a quota para forçar paginação (ex: 12 produtos)
    // Isso deve obrigar o scraper a ir para a página 2 ou 3 se a página 1 não tiver 12 vestidos válidos (adultos, <40% off)
    const QUOTA = 12;
    console.log(`🚀 Iniciando teste ISOLADO do FARM com QUOTA ${QUOTA}...`);
    console.log('Objetivo: Verificar se ele navega entre páginas para preencher a quota antes de mudar de categoria.');

    try {
        const products = await scrapeFarm(QUOTA);

        console.log('\n📊 RELATÓRIO FINAL DO TESTE:');
        console.log(`Total coletado: ${products.length}/${QUOTA}`);

        // Agrupamento por Categoria
        const byCat = {};
        products.forEach(p => {
            byCat[p.categoria] = (byCat[p.categoria] || 0) + 1;
        });
        console.log('Distribuição:', byCat);

        // Detalhes
        console.log('\nLista de Produtos:');
        products.forEach(p => {
            // Extrai parâmetro de página se existir na URL debug (não salvamos page na url, mas podemos inferir pela ordem ou log)
            console.log(`- [${p.id}] ${p.nome} | R$${p.precoAtual} | ${p.categoria} | Sizes: ${p.tamanhos.join(',')}`);
        });

    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }

    // Force exit
    process.exit(0);
})();
