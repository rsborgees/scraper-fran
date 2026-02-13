require('dotenv').config();
const { setupBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');

async function testDressToSearch() {
    console.log('\n🔍 [TEST] Testando nova estratégia DressTo...\n');

    const { context } = await setupBrowser();

    // IDs de teste (alguns dos que estavam falhando)
    const testItems = [
        { id: '02083385', store: 'dressto', isFavorito: false, driveUrl: 'https://drive.google.com/uc?export=download&id=test' },
        { id: '01332543', store: 'dressto', isFavorito: false, driveUrl: 'https://drive.google.com/uc?export=download&id=test' }
    ];

    try {
        const result = await scrapeSpecificIdsGeneric(context, testItems, 'dressto', 2);

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESULTADO DO TESTE');
        console.log('='.repeat(60));
        console.log(`✅ Produtos capturados: ${result.products.length}`);
        console.log(`📈 Stats:`, result.stats);

        if (result.products.length > 0) {
            console.log('\n🎉 Produtos encontrados:');
            result.products.forEach((p, i) => {
                console.log(`\n[${i + 1}] ${p.nome}`);
                console.log(`    💰 Preço: R$ ${p.precoAtual}`);
                console.log(`    🔗 URL: ${p.url}`);
            });
        }

    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        await context.close();
    }
}

testDressToSearch();
