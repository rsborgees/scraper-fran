const { scrapeDressTo } = require('./scrapers/dressto/index');

async function run() {
    console.log('🧪 Iniciando Teste de Verificação - Dress To');
    try {
        // Solicita 3 itens para ter uma amostra.
        // O scraper já tem lógica de ignorar duplicados, então se ele achar duplicados,
        // isso confirma que a estracao de ID e Navegação estao funcionando.
        const results = await scrapeDressTo(3);

        console.log('\n📊 Resumo do Teste:');
        console.log(`Itens retornados (não duplicados/novos): ${results.length}`);
        results.forEach(p => {
            console.log(`- OK: ${p.nome} | R$${p.precoAtual} | Categ: ${p.categoria}`);
        });

        if (results.length === 0) {
            console.log('⚠️ Nenhum item NOVO coletado (possivelmente todos eram duplicados ou erro de parse). Verifique os logs acima.');
        }

    } catch (err) {
        console.error('❌ Erro durante o teste:', err);
    }
}

run();
