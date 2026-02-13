const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');

async function testSets() {
    console.log('🧪 Iniciando TESTE DE CONJUNTOS (Farm)...');

    // Mock drive items
    const driveItems = [
        {
            id: '351693',
            ids: ['351693', '350740'],
            isSet: true,
            isFavorito: true,
            store: 'farm',
            driveUrl: 'https://drive.google.com/uc?export=download&id=mock_file_id'
        }
    ];

    const { browser, context } = await initBrowser();

    try {
        const results = await scrapeSpecificIds(context, driveItems, 1);
        console.log('\n📊 RESULTADOS DO TESTE:');
        console.log(JSON.stringify(results, null, 2));

        if (results.length > 0) {
            const product = results[0];
            if (product.isSet) {
                console.log('✅ SUCESSO: Conjunto identificado e mesclado.');
            } else {
                console.log('❌ FALHA: Produto não marcado como conjunto.');
            }
        } else {
            console.log('⚠️ Nenhum produto encontrado (verifique se os IDs existem no site).');
        }
    } catch (err) {
        console.error('❌ Erro no teste:', err.message);
    } finally {
        await browser.close();
    }
}

testSets();
