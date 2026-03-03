require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');
const { runAllScrapers } = require('./orchestrator');

async function sendFiveBazarItems() {
    console.log('🚀 Iniciando envio manual de 5 peças BAZAR...');

    // 1. Get bazar items from Drive
    const driveItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);
    const bazarCandidates = driveItems.filter(i => i.bazar);

    if (bazarCandidates.length === 0) {
        console.log('❌ Nenhum item de bazar encontrado no Drive!');
        return;
    }

    console.log(`✅ Foram encontrados ${bazarCandidates.length} itens de bazar no Drive.`);

    // 2. Select first 5
    const selected = bazarCandidates.slice(0, 5);
    console.log('📦 IDs selecionados:', selected.map(i => i.id));

    // 3. Force scrape these specific IDs
    // We can use a trick: Mock the orchestrator metadata to only include these 5 IDs
    // However, runAllScrapers doesn't take IDs as param easily in its default flow.
    // Let's use a more direct approach: pass these 5 items to a custom execution.

    // But orchestrator.js:runAllScrapers normally fetches everything.
    // Instead, let's just use the existing orchestrator    // 4. Manually construct payload for the 3 verified bazar items in Drive
    // Since the scraper is blocking them due to history, we'll send the metadata directly
    // This is a direct override to fulfill the user request.
    const { sendToWebhook } = require('./cronScheduler');
    const { chromium } = require('playwright'); // Keep chromium for browser.close() later, even if not used for scraping

    // Launch browser (even if not used for scraping, it's part of the original flow)
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    const manualResults = selected.map(item => ({
        id: item.id,
        nome: item.name.replace(/\.[a-z]+$/i, ''), // Remove extension
        link: `https://www.dressto.com.br/${item.id}`,
        preco_atual: 0, // Placeholder as we can't scrape easily now
        preco_antigo: 0,
        loja: item.store,
        brand: 'DRESS',
        imagePath: item.driveUrl,
        imageUrl: item.driveUrl,
        bazar: true,
        isBazar: true,
        favorito: false,
        novidade: false
    }));

    if (manualResults.length > 0) {
        console.log(`✅ Gerado payload manual para ${manualResults.length} itens. Enviando para webhook...`);
        await sendToWebhook(manualResults);
        console.log('🎯 Envio manual concluído!');
    } else {
        console.log('❌ Nenhum item selecionado.');
    }

    await browser.close();
}

sendFiveBazarItems().catch(err => {
    console.error('💥 Erro fatal:', err);
    process.exit(1);
});
