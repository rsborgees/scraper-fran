const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsDressTo } = require('./scrapers/dressto/idScanner');

async function testDressToDrive() {
    console.log('🧪 TESTE ISOLADO: DRESS TO DRIVE-FIRST');

    // Mock do item do Drive
    const mockDriveItems = [
        {
            id: '01342621', // Valid ID: Vestido Coluna Tule Estampa Areia (Tem tamanhos indisponíveis)
            driveUrl: 'https://drive.google.com/uc?id=TESTE_DRIVE_LINK',
            isFavorito: true
        }
    ];

    console.log('🚀 Iniciando navegador...');
    const { browser } = await initBrowser();

    try {
        console.log('🏃 Executando scrapeSpecificIdsDressTo...');
        const products = await scrapeSpecificIdsDressTo(browser, mockDriveItems);

        console.log('\n📊 RESULTADO DO TESTE:');
        console.log(JSON.stringify(products, null, 2));

    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        console.log('🔒 Fechando navegador...');
        await browser.close();
    }
}

testDressToDrive();
