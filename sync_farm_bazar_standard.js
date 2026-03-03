require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { sendToWebhook } = require('./cronScheduler');
const { chromium } = require('playwright');

async function syncFarmBazar() {
    console.log('🚀 Iniciando sincronização padrão de 5 peças BAZAR FARM...');

    // 1. Buscar os itens reais do Drive (após o fix de detecção)
    const allDriveItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);
    const farmBazarItems = allDriveItems.filter(i => i.store === 'farm' && i.bazar);

    if (farmBazarItems.length === 0) {
        console.log('❌ Nenhum item BAZAR da FARM encontrado no Drive! Verifique o fix no driveManager.js');
        return;
    }

    console.log(`✅ Encontrados ${farmBazarItems.length} itens BAZAR FARM no Drive.`);

    // 2. Selecionar um pool maior para garantir 5 sucessos (alguns podem estar esgotados)
    const selected = farmBazarItems.slice(0, 15);
    console.log('📦 IDs candidatos:', selected.map(i => i.id));

    // 3. Inicializar navegador
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    try {
        // 4. Scrapear via sistema oficial (pega preços e garante payload padrão)
        // maxAgeHours: 0 para forçar o envio mesmo que já tenha ido
        const scrapeResult = await scrapeSpecificIds(context, selected, 5, { maxAgeHours: 0 });
        const results = scrapeResult.products || [];

        if (results.length > 0) {
            console.log(`✅ Coletados ${results.length} itens. Enviando via Webhook oficial...`);

            // 5. Enviar via Webhook oficial do sistema
            await sendToWebhook(results);
            console.log('🎯 Sincronização Farm Bazar concluída com sucesso!');
        } else {
            console.log('❌ Falha ao scrapear itens (provavelmente esgotados no site).');
        }
    } catch (err) {
        console.error('❌ Erro no processo:', err.message);
    } finally {
        await browser.close();
    }
}

syncFarmBazar().catch(console.error);
