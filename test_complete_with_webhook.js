/**
 * Teste Completo do Sistema com Validação de Distribuição e Envio ao Webhook
 * - Valida distribuição de categorias da Farm (75% vestidos)
 * - Coleta produtos de todas as lojas
 * - Envia para o webhook
 */

const { runAllScrapers } = require('./orchestrator');
const { sendToWebhook } = require('./cronScheduler');

async function testCompleteSystemWithWebhook() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  TESTE COMPLETO - Sistema Multi-Loja com Webhook         ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📋 Configuração:');
    console.log('   - FARM: 7 produtos (75% vestidos, 10% macacão, etc)');
    console.log('   - DressTo: 1 produto');
    console.log('   - KJU: 1 produto');
    console.log('   - Live: 2 produtos');
    console.log('   - ZZMall: 1 produto');
    console.log('   - TOTAL: 12 produtos\n');

    try {
        const startTime = Date.now();

        // 1. Executa todos os scrapers
        console.log('🚀 Iniciando coleta de todas as lojas...\n');
        const allProducts = await runAllScrapers();

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000 / 60).toFixed(1);

        // 2. Análise dos resultados
        console.log('\n' + '═'.repeat(60));
        console.log('📊 ANÁLISE DOS RESULTADOS');
        console.log('═'.repeat(60));

        console.log(`\n⏱️  Tempo total: ${duration} minutos`);
        console.log(`📦 Total coletado: ${allProducts.length}/12 produtos\n`);

        // Agrupa por loja
        const byStore = {};
        allProducts.forEach(p => {
            const store = p.loja || 'desconhecido';
            if (!byStore[store]) byStore[store] = [];
            byStore[store].push(p);
        });

        console.log('🏪 Distribuição por Loja:');
        Object.keys(byStore).sort().forEach(store => {
            const count = byStore[store].length;
            console.log(`   ${store.toUpperCase()}: ${count} produtos`);
        });

        // 3. Validação específica da FARM
        const farmProducts = byStore['farm'] || [];
        if (farmProducts.length > 0) {
            console.log('\n🌸 Análise Detalhada - FARM:');

            // Agrupa por categoria
            const farmByCategory = {};
            farmProducts.forEach(p => {
                const cat = p.categoria || 'outros';
                if (!farmByCategory[cat]) farmByCategory[cat] = 0;
                farmByCategory[cat]++;
            });

            console.log('   📊 Distribuição por Categoria:');
            Object.keys(farmByCategory).sort().forEach(cat => {
                const count = farmByCategory[cat];
                const percentage = ((count / farmProducts.length) * 100).toFixed(1);
                console.log(`      ${cat}: ${count} (${percentage}%)`);
            });

            // Validação da distribuição
            const vestidos = farmByCategory['vestido'] || 0;
            const vestidoPercentage = (vestidos / farmProducts.length) * 100;

            console.log('\n   ✅ Validações:');
            if (farmProducts.length === 7) {
                console.log('      ✅ Quota Farm atingida: 7/7');
            } else {
                console.log(`      ⚠️  Quota Farm: ${farmProducts.length}/7`);
            }

            if (vestidoPercentage >= 70 && vestidoPercentage <= 90) {
                console.log(`      ✅ Distribuição de vestidos OK: ${vestidoPercentage.toFixed(1)}% (esperado 70-90%)`);
            } else {
                console.log(`      ⚠️  Distribuição de vestidos: ${vestidoPercentage.toFixed(1)}% (esperado 70-90%)`);
            }
        }

        // 4. Validação geral
        console.log('\n' + '═'.repeat(60));
        console.log('✅ VALIDAÇÕES GERAIS');
        console.log('═'.repeat(60));

        const validations = [];

        // Valida quota total
        if (allProducts.length === 12) {
            validations.push('✅ Quota total atingida: 12/12');
        } else if (allProducts.length >= 10) {
            validations.push(`⚠️  Quota próxima: ${allProducts.length}/12 (aceitável com duplicatas)`);
        } else {
            validations.push(`❌ Quota baixa: ${allProducts.length}/12`);
        }

        // Valida IDs únicos
        const ids = new Set(allProducts.map(p => p.id));
        if (ids.size === allProducts.length) {
            validations.push(`✅ Todos os IDs são únicos: ${ids.size}`);
        } else {
            validations.push(`⚠️  IDs duplicados: ${allProducts.length - ids.size}`);
        }

        // Valida mensagens
        const withMessages = allProducts.filter(p => p.message && p.message.length > 0);
        if (withMessages.length === allProducts.length) {
            validations.push('✅ Todas as mensagens foram geradas');
        } else {
            validations.push(`❌ Mensagens faltando: ${allProducts.length - withMessages.length}`);
        }

        validations.forEach(v => console.log('   ' + v));

        // 5. Amostra de produtos
        console.log('\n' + '═'.repeat(60));
        console.log('📦 AMOSTRA DE PRODUTOS (3 primeiros)');
        console.log('═'.repeat(60));

        allProducts.slice(0, 3).forEach((p, i) => {
            console.log(`\n${i + 1}. [${p.loja.toUpperCase()}] ${p.nome || 'Sem nome'}`);
            console.log(`   ID: ${p.id}`);
            console.log(`   Preço: R$ ${p.precoOriginal} → R$ ${p.precoAtual}`);
            if (p.categoria) console.log(`   Categoria: ${p.categoria}`);
        });

        // 6. Decisão de envio ao webhook
        console.log('\n' + '═'.repeat(60));
        console.log('📤 ENVIO AO WEBHOOK');
        console.log('═'.repeat(60));

        if (allProducts.length === 0) {
            console.log('\n❌ Nenhum produto para enviar. Abortando envio ao webhook.');
            return;
        }

        console.log(`\n✅ ${allProducts.length} produtos prontos para envio`);
        console.log('🚀 Enviando para webhook...\n');

        const webhookResult = await sendToWebhook(allProducts);

        if (webhookResult && webhookResult.success) {
            console.log('\n✅ SUCESSO! Produtos enviados ao webhook.');
        } else {
            console.log('\n⚠️  Webhook retornou resultado inesperado. Verifique os logs acima.');
        }

        // 7. Resumo Final
        console.log('\n' + '═'.repeat(60));
        console.log('🏁 RESUMO FINAL');
        console.log('═'.repeat(60));
        console.log(`⏱️  Tempo: ${duration} min`);
        console.log(`📦 Produtos: ${allProducts.length}/12`);
        console.log(`📤 Status Webhook: ${webhookResult?.success ? 'ENVIADO' : 'ERRO'}`);
        console.log('═'.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:');
        console.error(error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
    }
}

// Executa o teste
testCompleteSystemWithWebhook().then(() => {
    console.log('✅ Teste completo finalizado');
    process.exit(0);
}).catch(err => {
    console.error('💥 Erro fatal:', err);
    process.exit(1);
});
