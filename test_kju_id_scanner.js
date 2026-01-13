const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');

async function testKjuDriveFirst() {
    process.env.HEADLESS = 'true';
    const { browser, context } = await initBrowser();

    // Using the ID we found earlier
    const driveItems = [{
        id: '36133853654', // Use the known working ID
        driveUrl: 'https://cdn.sistemawbuy.com.br/arquivos/cf9beb9eec26e27072f7552c4e418b6a/produtos/696273e224541/whatsapp-image-2026-01-12-at-11-33-14-696506d698370_mini.jpeg',
        isFavorito: true,
        store: 'kju'
    }];

    try {
        console.log('🚀 Testando ID Scanner GENERIC para KJU (com Contexto/Stealth)...');
        const products = await scrapeSpecificIdsGeneric(context, driveItems, 'kju');

        console.log('✅ Resultado:', JSON.stringify(products, null, 2));

    } catch (e) {
        console.error(`❌ Erro: ${e.message}`);
        if (page) await page.screenshot({ path: 'kju_id_scanner_fail.png' });
    } finally {
        await browser.close();
    }
}

testKjuDriveFirst();
