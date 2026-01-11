const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');

async function testFarmNotFound() {
    console.log('🧪 TESTE ISOLADO: FARM NOT FOUND LOGIC');

    // Mock com ID inexistente
    const mockDriveItems = [
        {
            id: '999999999', // ID inválido
            driveUrl: 'https://drive.google.com/uc?id=TESTE_DRIVE_LINK',
            isFavorito: false
        }
    ];

    console.log('🚀 Iniciando navegador...');
    const { browser } = await initBrowser();

    try {
        console.log('🏃 Executando scrapeSpecificIds (Farm)...');
        const products = await scrapeSpecificIds(browser, mockDriveItems);

        console.log('\n📊 RESULTADO DO TESTE (Esperado array vazio):');
        console.log(JSON.stringify(products, null, 2));

    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        console.log('🔒 Fechando navegador...');
        await browser.close();
    }
}

testFarmNotFound();
