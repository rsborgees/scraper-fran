require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { buildMessageForProduct } = require('./messageBuilder');
const { chromium } = require('playwright');
const axios = require('axios');

const WEBHOOK_URL = 'https://n8n-francalheira.vlusgm.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

async function syncFarmBazarDefinitive() {
    console.log('🚀 Iniciando sincronização DEFINITIVA de 5 peças BAZAR FARM...');

    // 1. Buscar itens do Drive
    const allDriveItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);
    const farmBazarItems = allDriveItems.filter(i => i.store === 'farm' && i.bazar);

    if (farmBazarItems.length === 0) {
        console.log('❌ Nenhum item BAZAR FARM encontrado.');
        return;
    }

    const selected = farmBazarItems.slice(0, 15);
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    try {
        const scrapeResult = await scrapeSpecificIds(context, selected, 5, { maxAgeHours: 0 });
        const results = scrapeResult.products || [];

        if (results.length > 0) {
            console.log(`\n✅ Coletados ${results.length} itens. Transformando para PAYLOAD PADRÃO (Array)...`);

            // 2. Transformar para o formato "Standard" (Array de objetos com chaves específicas)
            const standardPayload = results.map(p => {
                // p tem precoAtual, precoOriginal, imageUrl (do drive), etc.
                const mapped = {
                    id: p.id,
                    name: p.nome,
                    price: p.precoAtual,
                    oldPrice: p.precoOriginal,
                    image: p.imageUrl, // URL do Drive fixada pelo idScanner
                    url: p.url,
                    store: 'farm',
                    bazar: true,
                    isBazar: true,
                    tamanhos: p.tamanhos || [],
                    message: buildMessageForProduct(p)
                };
                return mapped;
            });

            console.log(`📤 Enviando array de ${standardPayload.length} produtos para webhook...`);

            const response = await axios.post(WEBHOOK_URL, standardPayload, {
                headers: { 'Content-Type': 'application/json' }
            });

            console.log(`✅ Webhook disparado! Status: ${response.status}`);
            console.log('🎯 Sincronização Final Farm Bazar concluída!');
        } else {
            console.log('❌ Falha ao coletar itens.');
        }

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await browser.close();
    }
}

syncFarmBazarDefinitive().catch(console.error);
