require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildFarmMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
const { loadHistory, normalizeId } = require('./historyManager');

async function sendFavoritos() {
    console.log('🚀 Iniciando envio de 20 favoritos da FARM...');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const allDriveItems = await getExistingIdsFromDrive(folderId);
    
    // Filter Farm Favoritos
    let candidatos = allDriveItems.filter(item => item.store === 'farm' && (item.isFavorito || item.favorito));
    console.log(`Encontrados ${candidatos.length} favoritos da Farm no Drive.`);
    
    // Sort taking oldest sent first
    const history = loadHistory();
    candidatos.forEach(item => {
        const normId = normalizeId(item.driveId || item.id);
        const historyEntry = history[normId];
        item._lastSent = historyEntry ? historyEntry.timestamp : 0;
    });

    candidatos.sort((a, b) => a._lastSent - b._lastSent);
    
    const targetItems = candidatos.slice(0, 20);
    console.log(`🎯 Selecionados ${targetItems.length} favoritos para enviar.`);
    
    if (targetItems.length === 0) return;

    const { browser, context } = await initBrowser();
    try {
        const { products } = await scrapeSpecificIds(context, targetItems, 20, { maxAgeHours: 0 });
        
        products.forEach(p => {
            p.message = buildFarmMessage(p);
            p.favorito = true;
            p.isFavorito = true;
        });
        
        console.log(`Enviando ${products.length} produtos para webhook...`);
        await sendToWebhook(products);
    } catch (e) {
        console.error('Erro:', e);
    } finally {
        await browser.close();
    }
}

sendFavoritos().then(() => {
    console.log('Done!');
    process.exit(0);
}).catch(console.error);
