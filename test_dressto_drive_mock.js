const { scrapeSpecificIdsDressTo } = require('./scrapers/dressto/idScanner');
const { initBrowser } = require('./browser_setup');

async function runTest() {
    console.log('🚙 TEST: Simulando Dress To c/ Item do Drive...');

    // 1. Mock de item do Drive (ID Real de um produto Dress To)
    // ID Exemplo pego anteriormente: 01332387 (Vestido Longo Lurex)
    const mockDriveItems = [
        {
            id: '01332387',
            driveUrl: 'https://drive.google.com/uc?export=download&id=TEST_IMAGE_ID',
            isFavorito: false,
            // nome, preco etc não importam na entrada, o scraper deve buscar
        }
    ];

    // 2. Init Browser
    const { browser } = await initBrowser();

    try {
        // 3. Executa a função de scrape por ID
        const results = await scrapeSpecificIdsDressTo(browser, mockDriveItems, 5);

        console.log('\n📊 RESULTADOS:');
        console.log(JSON.stringify(results, null, 2));

        if (results.length > 0) {
            console.log('✅ SUCESSO: Item encontrado e parseado.');
        } else {
            console.log('❌ FALHA: Item não retornado.');
        }

    } catch (err) {
        console.error('❌ Erro no teste:', err);
    } finally {
        await browser.close();
    }
}

runTest();
