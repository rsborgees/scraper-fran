const { chromium } = require('playwright');
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { buildZzMallMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

(async () => {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const allDriveItems = await getExistingIdsFromDrive(folderId);

    // IDs already sent in previous steps
    const sentIds = ['5003600320004'];

    const zzmallSearch = allDriveItems
        .filter(item => item.store === 'zzmall' && !sentIds.includes(item.id))
        .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
        .slice(0, 20);

    console.log(`🔍 Tentando buscar mais 2 itens da ZZMall (batch de ${zzmallSearch.length} candidates)...`);

    const browser = await chromium.launch();
    const context = await browser.newContext();

    try {
        const { products } = await scrapeSpecificIdsGeneric(context, zzmallSearch, 'zzmall', 2);

        if (products.length > 0) {
            console.log(`✅ ${products.length} produtos encontrados.`);
            products.forEach(p => {
                p.message = buildZzMallMessage(p);
                console.log(`   🔸 [${p.id}] ${p.nome}`);
            });

            console.log('📤 Enviando para Webhook...');
            const res = await sendToWebhook(products);
            console.log('🏁 Resultado:', res);
        } else {
            console.log('❌ Nenhum produto encontrado nos candidatos.');
        }
    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await browser.close();
        console.log('🏁 Finalizado.');
    }
})();
