const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');

async function testSets() {
    console.log('🧪 Iniciando TESTE DE INTEGRAÇÃO DE CONJUNTOS (Farm)...');

    // Conjunto de exemplo: Vestido (316075) e outro item se existir, ou dois IDs válidos.
    // Usando IDs reais conhecidos para garantir que o scraper encontre algo.
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

        if (results.length > 0) {
            const product = results[0];
            console.log(`Nome: ${product.nome}`);
            console.log(`ID Composto: ${product.id}`);
            console.log(`Preço Original Total: R$ ${product.precoOriginal}`);
            console.log(`Preço Atual Total (com 10% off): R$ ${product.precoAtual}`);

            if (product.isSet && product.id.includes('_')) {
                console.log('✅ SUCESSO: Conjunto identificado, pesquisado e mesclado corretamente.');
            } else if (results.length === 1 && !product.isSet) {
                console.log('⚠️  ALERTA: Apenas um produto foi encontrado, mas o sistema lidou com a falha do outro ID.');
            }
        } else {
            console.log('❌ FALHA: Nenhum produto foi capturado.');
        }
    } catch (err) {
        console.error('❌ Erro durante o teste:', err.stack);
    } finally {
        await browser.close();
        console.log('🔓 Navegador fechado.');
    }
}

testSets();
