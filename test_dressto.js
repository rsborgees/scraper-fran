const { scrapeDressTo } = require('./scrapers/dressto');
const { buildDressMessage } = require('./messageBuilder');

async function test() {
    console.log('--- TESTE ISOLADO DRESS TO (QUOTA: 2) ---');
    try {
        const results = await scrapeDressTo(2);
        console.log(`\n--- RESULTADOS DO TESTE: ${results.length} PRODUTOS ---`);

        results.forEach((p, i) => {
            const msg = buildDressMessage(p);
            console.log(`\n[PRODUTO ${i + 1}]`);
            console.log(msg);
            console.log('-----------------------------------');
        });

        if (results.length === 0) {
            console.log('⚠️ Nenhum produto retornado. Possíveis causas:');
            console.log('1. Todos os itens encontrados já estão no histórico (duplicados).');
            console.log('2. Falha ao carregar a página.');
        }

    } catch (error) {
        console.error('Erro no teste Dress To:', error);
    }
}

test();
