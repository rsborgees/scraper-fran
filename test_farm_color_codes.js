const { scrapeFarm } = require('./scrapers/farm/index.js');

/**
 * Teste: Verificar se códigos com cores estão sendo capturados corretamente
 * Exemplo esperado: 357793_51202 (não apenas 357793)
 */
(async () => {
    console.log('🧪 TESTE: Captura de Códigos com Cores\n');

    try {
        // Scrape 10 produtos em modo dry-run
        const products = await scrapeFarm(10, true);

        console.log('\n📊 RESULTADOS:\n');
        console.log(`Total de produtos capturados: ${products.length}\n`);

        // Analisa os IDs capturados
        const idsWithColor = [];
        const idsWithoutColor = [];

        products.forEach((p, idx) => {
            const hasColorCode = /_/.test(p.id);
            console.log(`${idx + 1}. ${p.nome}`);
            console.log(`   ID: ${p.id} ${hasColorCode ? '✅ (com cor)' : '⚠️  (sem cor)'}`);
            console.log(`   URL: ${p.url}\n`);

            if (hasColorCode) {
                idsWithColor.push(p.id);
            } else {
                idsWithoutColor.push(p.id);
            }
        });

        console.log('\n📈 ESTATÍSTICAS:');
        console.log(`✅ IDs com código de cor: ${idsWithColor.length}`);
        console.log(`⚠️  IDs sem código de cor: ${idsWithoutColor.length}`);

        if (idsWithColor.length > 0) {
            console.log('\n✅ SUCESSO: Códigos com cores estão sendo capturados!');
            console.log('Exemplos:', idsWithColor.slice(0, 3).join(', '));
        } else {
            console.log('\n❌ PROBLEMA: Nenhum código com cor foi capturado.');
        }

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
})();
