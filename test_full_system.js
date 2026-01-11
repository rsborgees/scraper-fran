const { runAllScrapers } = require('./orchestrator');

async function testFullSystem() {
    console.log('--- TESTE DE VALIDAÇÃO (2 PASSOS) ---');

    // Configuração de Quota Pequena para Rapidez
    const quotas = {
        farm: 4,     // Tenta pegar 4
        dressto: 2,
        kju: 2,
        live: 4,     // Tenta formar sets
        zzmall: 2
    };

    console.log('\n🔵 PASSO 1: Captura Inicial');
    const products1 = await runAllScrapers(quotas);
    console.log(`\n📦 Produtos Capturados no Passo 1: ${products1.length}`);

    // Verifica conteúdo das mensagens
    console.log('\n📝 Verificando Formatação das Mensagens (Amostra):');
    const stores = ['farm', 'dressto', 'kju', 'live', 'zzmall'];
    stores.forEach(store => {
        const p = products1.find(x => x.loja === store);
        if (p) {
            console.log(`\n--- [${store.toUpperCase()}] ---`);
            console.log(p.message);
            if (store === 'farm') console.log(`> TimerAtivo: ${p.timerData?.ativo}, Cupom: ${p.timerData?.cupom}`);
        }
    });

    console.log('\n\n🔵 PASSO 2: Teste de Duplicidade (Rodando novamente)');
    console.log('Esperamos que os scrapers pulem os itens já capturados...');

    // Pequena pausa
    await new Promise(r => setTimeout(r, 2000));

    const products2 = await runAllScrapers(quotas);
    console.log(`\n📦 Produtos Capturados no Passo 2: ${products2.length}`);

    if (products2.length < products1.length) {
        console.log('✅ SUCESSO: O sistema detectou duplicatas e pulou itens (ou capturou novos apenas).');
    } else if (products2.length === 0) {
        console.log('✅ SUCESSO TOTAL: Todos os itens eram duplicados e foram pulados.');
    } else {
        console.log('⚠️ NOTA: Produtos foram capturados. Verifique se são NOVOS ou se o filtro falhou.');
        // Lista IDs
        const ids1 = products1.map(p => p.id);
        const ids2 = products2.map(p => p.id);
        const intersection = ids2.filter(id => ids1.includes(id));
        if (intersection.length > 0) {
            console.error('❌ FALHA: IDs repetidos detectados:', intersection);
        } else {
            console.log('✅ IDs capturados no Passo 2 são diferentes do Passo 1 (Novos produtos)');
        }
    }
}

testFullSystem().catch(e => console.error(e));
