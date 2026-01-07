const { scrapeFarm } = require('./scrapers/farm');

async function testFarmQuota() {
    console.log('🧪 TESTE: Verificando se Farm atinge quota de 7 produtos...\n');

    const startTime = Date.now();
    const products = await scrapeFarm(7);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO DO TESTE');
    console.log('='.repeat(60));
    console.log(`Quota alvo: 7 produtos`);
    console.log(`Produtos coletados: ${products.length}`);
    console.log(`Tempo de execução: ${duration}s`);
    console.log(`Status: ${products.length >= 7 ? '✅ SUCESSO' : '❌ FALHOU'}`);

    if (products.length > 0) {
        console.log('\n📦 Produtos coletados:');
        products.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.nome} - R$ ${p.precoAtual} (${p.tamanhos?.length || 0} tamanhos)`);
        });
    }

    console.log('='.repeat(60));

    process.exit(products.length >= 7 ? 0 : 1);
}

testFarmQuota();
