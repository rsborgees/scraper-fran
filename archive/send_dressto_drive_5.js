const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { buildDressMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
const { initBrowser } = require('./browser_setup');
require('dotenv').config();

async function runDriveTest() {
    console.log('👗 Iniciando Teste de 5 itens Dress To via DRIVE-FIRST...');
    const { browser, page } = await initBrowser();
    const context = page.context();

    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        // Usa o defaultStore 'dressto' que acabamos de implementar
        const allDriveItems = await getExistingIdsFromDrive(folderId, 'dressto');
        const dressItems = allDriveItems.filter(i => i.store === 'dressto');

        console.log(`📊 Total Dress To no Drive: ${dressItems.length}`);

        if (dressItems.length === 0) {
            console.log('❌ Nenhum item Dress To encontrado no Drive.');
            return;
        }

        // Pega uma amostra de 30 (mais chances de achar stock) ordenados por data
        const candidates = dressItems
            .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
            .slice(0, 30);

        console.log(`🔍 Scrapeando até 5 de ${candidates.length} melhores candidatos...`);
        const { products } = await scrapeSpecificIdsGeneric(context, candidates, 'dressto', 5);

        if (products.length === 0) {
            console.log('❌ Nenhum produto capturado com sucesso.');
            return;
        }

        // Build messages
        products.forEach(p => {
            p.message = buildDressMessage(p);
            p.loja = 'dressto';
        });

        console.log(`📤 Enviando ${products.length} itens para o webhook...`);
        await sendToWebhook(products);
        console.log('✅ Teste concluído com sucesso!');

    } catch (e) {
        console.error('❌ Erro no teste:', e);
    } finally {
        await browser.close();
    }
}

runDriveTest();
