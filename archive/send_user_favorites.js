const axios = require('axios');
const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { buildFarmMessage } = require('./messageBuilder');
const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

const idsToSend = [
    '358001',
    '356090',
    '355078',
    '356023',
    '356094',
    '356024',
    '358356',
    '358015'
];

async function run() {
    console.log(`🚀 Iniciando envio de ${idsToSend.length} favoritos específicos para o webhook...\n`);

    // 1. Buscar itens no Drive para pegar os links das fotos
    console.log('📂 Buscando links de imagem no Google Drive...');
    const allDriveItems = await getExistingIdsFromDrive(DRIVE_FOLDER_ID);
    const driveItems = allDriveItems.filter(item => idsToSend.includes(item.id));

    console.log(`✅ Encontrados ${driveItems.length} dos ${idsToSend.length} itens no Drive.`);

    // 2. Scrapar dados da Farm usando o scanner específico
    const { browser, context } = await initBrowser();
    const page = await context.newPage();
    const products = [];

    try {
        console.log('🌸 Coletando dados da Farm (Coleta Direta SEM restrição de histórico)...');

        for (const item of driveItems) {
            console.log(`\n🔍 Buscando ID ${item.id}...`);

            try {
                // API Call
                const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${item.id}`;
                const response = await page.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                let productsJson = await response.json();

                if (!productsJson || productsJson.length === 0) {
                    console.log(`      ⚠️ ID ${item.id} não encontrado na API.`);
                    continue;
                }

                const productData = productsJson[0];
                console.log(`      🎯 Encontrado na API: ${productData.productName}`);

                const { parseProduct } = require('./scrapers/farm/parser');
                const product = await parseProduct(page, productData.link);

                if (product) {
                    // Injetar dados do Drive/Manual
                    product.imagePath = item.driveUrl; // Importante para o user (fotos do drive)
                    product.favorito = true;
                    product.loja = 'farm';
                    products.push(product);
                    console.log(`      ✅ Sucesso: ${product.nome}`);
                }
            } catch (err) {
                console.error(`      ❌ Erro ao processar ${item.id}: ${err.message}`);
            }
        }

        console.log(`\n📦 Total coletado com sucesso: ${products.length} itens.`);

        // 3. Formatar e enviar como lote padrão (conforme cronScheduler.js)
        const payload = {
            timestamp: new Date().toISOString(),
            totalProducts: products.length,
            products: products.map(p => ({
                ...p,
                image: p.imagePath || p.imageUrl, // Link do drive injetado
                caption: buildFarmMessage(p, null),
                is_manual: true
            })),
            summary: {
                farm: products.length,
                dressto: 0,
                kju: 0,
                live: 0,
                zzmall: 0
            }
        };

        console.log(`\n📤 Enviando LOTE com ${products.length} itens para o webhook...`);

        try {
            const response = await axios.post(WEBHOOK_URL, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });
            console.log(`   ✅ SUCESSO! Status: ${response.status}`);
            console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
        } catch (err) {
            console.error(`   ❌ ERRO no Webhook: ${err.message}`);
            if (err.response) console.log('      Response data:', err.response.data);
        }

    } catch (err) {
        console.error('❌ Erro Crítico:', err);
    } finally {
        await browser.close();
    }
}

run();
