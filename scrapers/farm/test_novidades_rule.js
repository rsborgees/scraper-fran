const { scrapeFarmSiteNovidades } = require('./siteNovidades');

async function testNovidadesRule() {
    console.log('🧪 Iniciando teste da regra de Novidades da Farm...');

    try {
        const results = await scrapeFarmSiteNovidades(1);

        console.log('\n📊 RESULTADOS:');
        console.log(`Quantidade: ${results.length}`);

        if (results.length === 1) {
            const item = results[0];
            console.log(`✅ Item capturado: ${item.nome} (${item.id})`);
            console.log(`   URL: ${item.url}`);
            console.log(`   isSiteNovidade: ${item.isSiteNovidade}`);
            console.log(`   Preço: ${item.precoAtual}`);
            console.log(`   Tamanhos: ${item.tamanhos.join(', ')}`);
        } else {
            console.log('❌ FALHA: A cota de 1 item não foi atingida ou foi excedida.');
        }

    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
    }
}

testNovidadesRule();
