const { scrapeZZMall } = require('./scrapers/zzmall');

async function testZZMall() {
    console.log('🧪 TESTE: Debugging ZZMall Scraper...\n');

    const startTime = Date.now();
    // Pede 5 produtos
    const products = await scrapeZZMall(5);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO DO TESTE (ZZMall)');
    console.log('='.repeat(60));
    console.log(`Produtos coletados: ${products.length}`);
    console.log(`Tempo de execução: ${duration}s`);

    if (products.length > 0) {
        products.forEach((p, i) => {
            console.log(`\n📦 Produto #${i + 1}:`);
            console.log(`   Nome: ${p.nome}`);
            console.log(`   Preço: R$ ${p.precoAtual} (De: R$${p.precoOriginal})`);
            console.log(`   Categoria: ${p.categoria}`);
            console.log(`   URL: ${p.url}`);
            console.log(`   Img: ${p.imagePath ? '✅ Sim' : '❌ Não'}`);
        });
    } else {
        console.log('\n⚠️ NENHUM PRODUTO ENCONTRADO.');
        console.log('Verifique:');
        console.log('1. Se a URL da Home tem links diretos para "/p/"');
        console.log('2. Se os filtros de categoria (só Sapatos/Acessórios) estão bloqueando tudo');
    }

    console.log('='.repeat(60));
}

testZZMall();
