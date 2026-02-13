const { scanCategory } = require('./scrapers/farm/scanner');

async function test() {
    console.log('--- TESTANDO ROLAGEM LENTA (FARM) ---');
    // Usando uma categoria com bastante itens para ver o scroll
    const url = 'https://www.farmrio.com.br/vestido';
    const candidates = await scanCategory(url, 'Vestidos', 15, 3); // 3 scrolls max, alvo 15
    console.log(`--- TESTE FINALIZADO: ${candidates.length} candidatos encontrados ---`);
}

test().catch(console.error);
