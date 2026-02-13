const { initBrowser } = require('./browser_setup');
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { buildDressMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

async function sendTenDressToFromDrive() {
    console.log('🚀 Iniciando disparo único: 10 peças Dress To do Drive...');

    let browser;
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) {
            throw new Error('GOOGLE_DRIVE_FOLDER_ID não configurado no .env');
        }

        const allDriveItems = await getExistingIdsFromDrive(folderId);
        const dressToItems = allDriveItems.filter(item => item.store === 'dressto');

        console.log(`📊 total de itens dressto no Drive: ${dressToItems.length}`);

        if (dressToItems.length === 0) {
            console.log('⚠️ Nenhum item Dress To encontrado no Drive.');
            return;
        }

        // Selecionar 10 itens (priorizando favoritos se houver)
        const selectedItems = dressToItems
            .sort((a, b) => (b.isFavorito ? 1 : 0) - (a.isFavorito ? 1 : 0))
            .slice(0, 10);

        console.log(`🎯 Selecionados ${selectedItems.length} itens para processar.`);

        const { browser: browserInstance, context } = await initBrowser();
        browser = browserInstance;

        const { products } = await scrapeSpecificIdsGeneric(context, selectedItems, 'dressto', 10);

        if (products.length > 0) {
            console.log(`\n📦 Total capturado: ${products.length} produtos.`);

            // Gerar mensagens
            products.forEach(p => p.message = buildDressMessage(p));

            console.log('📤 Enviando para o webhook...');
            const result = await sendToWebhook(products);

            if (result.success) {
                console.log('✅ Disparo concluído com sucesso!');
            } else {
                console.error('❌ Falha no envio para o webhook:', result.error);
            }
        } else {
            console.log('⚠️ Nenhum produto Dress To foi capturado com sucesso.');
        }

    } catch (error) {
        console.error('❌ Erro durante o disparo:', error.message);
    } finally {
        if (browser) await browser.close();
        console.log('🏁 Processo finalizado.');
    }
}

sendTenDressToFromDrive();
