/**
 * Teste do Scraper Farm com Quota de 7
 * Valida as correções implementadas
 */

const { scrapeFarm } = require('./scrapers/farm');

async function testFarmQuota7() {
    console.log('🧪 TESTE: Scraper Farm com Quota 7\n');
    console.log('='.repeat(60));
    console.log('Objetivo: Verificar se coleta exatamente 7 produtos');
    console.log('Distribuição esperada: ~6 vestidos + ~1 macacão');
    console.log('='.repeat(60) + '\n');

    try {
        const startTime = Date.now();

        // Executa o scraper com quota de 7 (modo DRY RUN = false para testar completo)
        const products = await scrapeFarm(7, false);

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESULTADO DO TESTE');
        console.log('='.repeat(60));

        console.log(`⏱️  Tempo de execução: ${duration}s`);
        console.log(`📦 Produtos coletados: ${products.length}/7`);

        // Análise por categoria
        const byCategory = {};
        products.forEach(p => {
            const cat = p.categoria || 'outros';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        });

        console.log('\n🏷️  Distribuição por categoria:');
        Object.keys(byCategory).forEach(cat => {
            const count = byCategory[cat];
            const percentage = ((count / products.length) * 100).toFixed(1);
            console.log(`   ${cat}: ${count} (${percentage}%)`);
        });

        // Validações
        console.log('\n✅ Validações:');

        const vestidos = byCategory['vestido'] || 0;
        const vestidoPercentage = (vestidos / products.length) * 100;

        if (products.length === 7) {
            console.log('   ✅ Quota atingida: 7 produtos');
        } else if (products.length < 7) {
            console.log(`   ⚠️  Quota não atingida: ${products.length}/7 produtos`);
        } else {
            console.log(`   ⚠️  Quota excedida: ${products.length}/7 produtos`);
        }

        if (vestidoPercentage >= 70 && vestidoPercentage <= 90) {
            console.log(`   ✅ Distribuição de vestidos OK: ${vestidoPercentage.toFixed(1)}% (esperado ~75-85%)`);
        } else {
            console.log(`   ⚠️  Distribuição de vestidos fora do esperado: ${vestidoPercentage.toFixed(1)}%`);
        }

        // Verifica se há IDs únicos
        const ids = new Set(products.map(p => p.id));
        if (ids.size === products.length) {
            console.log(`   ✅ Todos os IDs são únicos: ${ids.size} produtos`);
        } else {
            console.log(`   ⚠️  IDs duplicados detectados: ${products.length - ids.size} duplicatas`);
        }

        // Lista produtos coletados
        console.log('\n📋 Produtos coletados:');
        products.forEach((p, i) => {
            const desconto = ((p.precoOriginal - p.precoAtual) / p.precoOriginal * 100).toFixed(0);
            console.log(`   ${i + 1}. [${p.id}] ${p.categoria} - R$${p.precoOriginal} → R$${p.precoAtual} (${desconto}% OFF)`);
        });

        console.log('\n' + '='.repeat(60));

        // Status final
        if (products.length === 7 && vestidoPercentage >= 70) {
            console.log('✅ TESTE PASSOU - Scraper funcionando corretamente!');
        } else {
            console.log('⚠️  TESTE COM AVISOS - Verifique os logs acima');
        }
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:');
        console.error(error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
    }
}

// Executa o teste
testFarmQuota7().then(() => {
    console.log('\n🏁 Teste finalizado');
    process.exit(0);
}).catch(err => {
    console.error('💥 Erro fatal:', err);
    process.exit(1);
});
