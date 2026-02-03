const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
require('dotenv').config();

(async () => {
    const { browser, context } = await initBrowser();

    // 1. Use a KNOWN, VALID Product ID that exists on ZZMall
    const VALID_ID = '1105700010178'; // SANDÁLIA RASTEIRA PRETA CROCO

    // 2. Simulate an entry coming from Google Drive with THIS ID
    // This proves that if the file exists in Drive with the correct name, the logic pairs it correctly.
    const mockDriveItems = [
        {
            id: VALID_ID,
            driveUrl: 'https://drive.google.com/uc?export=download&id=TEST_FILE_ID_FOR_SANDAL',
            isFavorito: true,
            store: 'zzmall'
        }
    ];

    console.log(`🚀 Teste de Integração Real: ID ${VALID_ID}`);
    console.log('Objetivo: Verificar se o sistema combina o Produto do Site com a Foto do Drive corretamente.');

    try {
        const result = await scrapeSpecificIdsGeneric(context, mockDriveItems, 'zzmall', 1);

        if (result.products.length > 0) {
            const product = result.products[0];

            console.log('\n✅ Produto Processado com Sucesso!');
            console.log('---------------------------------------------------');
            console.log(`🆔 ID do Produto:    ${product.id}`);
            console.log(`📦 Nome no Site:     ${product.nome}`);
            console.log(`🔗 Link do Produto:  ${product.url}`);
            console.log(`🖼️  Foto (Drive):     ${product.imagePath}`);
            console.log('---------------------------------------------------');

            if (product.id === VALID_ID && product.imagePath.includes('TEST_FILE_ID_FOR_SANDAL')) {
                console.log('✅ SUCESSO: A foto do Drive foi corretamente atribuída ao produto certo!');
            } else {
                console.error('❌ ERRO: Houve inconsistência nos dados.');
            }

        } else {
            console.log('\n❌ Produto não encontrado no site (pode estar esgotado ou ID mudou).');
        }
    } catch (error) {
        console.error('❌ Erro durante o teste:', error);
    } finally {
        await browser.close();
    }
})();
