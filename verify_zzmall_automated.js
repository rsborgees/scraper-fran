const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { buildZzMallMessage } = require('./messageBuilder');
const { findFileByProductId } = require('./driveManager');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-francalheira.vlusgm.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function testZzMallAuto(targetId) {
    console.log(`\n🧪 INICIANDO TESTE AUTOMATIZADO ZZMALL PARA ID: ${targetId}`);

    const { browser, context } = await initBrowser();
    const storeItems = [{ id: targetId, store: 'zzmall' }];

    try {
        console.log(`🔍 Chamando scrapeSpecificIdsGeneric para ${targetId}...`);
        const result = await scrapeSpecificIdsGeneric(context, storeItems, 'zzmall', 1);

        if (result.products && result.products.length > 0) {
            const product = result.products[0];
            console.log(`✅ Produto capturado: ${product.nome}`);

            // 1. Lógica de Drive que o orchestrador/cron usaria
            console.log('📂 Buscando link no Drive para complementar o payload...');
            const driveFile = await findFileByProductId(folderId, targetId);

            // 2. Montar payload "Padrão Francalheira"
            const fullProduct = {
                ...product,
                image: product.imagePath, // Cloudinary (idScanner já faz o upload)
                imageUrl: driveFile ? driveFile.driveUrl : product.imageUrl,
                imagePath: driveFile ? driveFile.driveUrl : product.imagePath,
                loja: 'zzmall',
                novidade: true,
                isNovidade: true,
                estoque: 99
            };

            fullProduct.message = buildZzMallMessage(fullProduct);

            const payload = {
                timestamp: new Date().toISOString(),
                totalProducts: 1,
                products: [fullProduct],
                summary: { farm: 0, dressto: 0, kju: 0, live: 0, zzmall: 1 }
            };

            console.log('📤 Enviando payload para Webhook...');
            const res = await axios.post(WEBHOOK_URL, payload);
            console.log(`✅ Webhook status: ${res.status}`);
            console.log('🚀 Payload:', JSON.stringify(payload, null, 2));

        } else {
            console.error('❌ Scraper não conseguiu encontrar o produto.');
        }

    } catch (err) {
        console.error('❌ Erro no teste automatizado:', err.message);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

// Testamos com o ID A1393700010001
const testId = process.argv[2] || 'A1393700010001';
testZzMallAuto(testId);
