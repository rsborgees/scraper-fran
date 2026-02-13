const { initBrowser } = require('./browser_setup');
const axios = require('axios');
const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

async function fetchFromIntelligentSearch() {
    console.log('🌐 Buscando via Intelligent Search API (Collection 2175)...');
    const { browser, page } = await initBrowser();

    try {
        // Primeiro, navegar para a home para pegar cookies
        await page.goto('https://www.farmrio.com.br/novidades', { waitUntil: 'networkidle', timeout: 60000 });

        const apiResult = await page.evaluate(async () => {
            const url = '/api/io/_v/api/intelligent-search/product_search/facets/collection/2175?O=OrderByReleaseDateDESC&_from=0&_to=20';
            const response = await fetch(url);
            return await response.json();
        });

        const products = apiResult.products || [];
        console.log(`✅ Produtos encontrados na API: ${products.length}`);

        if (products.length === 0) {
            console.log('❌ Nenhum produto na API.');
            return;
        }

        const driveIds = (await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID)).map(i => i.id);

        const results = [];
        for (const p of products) {
            if (results.length >= 2) break;

            const baseId = p.productReference;
            if (driveIds.includes(baseId)) {
                console.log(`⏭️ Ignorando ${baseId} (Já no Drive)`);
                continue;
            }

            // Mapear para o formato do webhook
            const item = {
                name: p.productName,
                id: baseId,
                sku: p.items[0].itemId,
                price: p.items[0].sellers[0].commertialOffer.Price,
                oldPrice: p.items[0].sellers[0].commertialOffer.ListPrice,
                url: `https://www.farmrio.com.br${p.link}`,
                image: p.items[0].images[0].imageUrl,
                stock: p.items[0].sellers[0].commertialOffer.AvailableQuantity,
                sizes: p.items[0].variations?.find(v => v.name === 'Tamanho')?.values || [],
                store: 'farm',
                novidade: true,
                isNovidade: true
            };

            if (item.stock > 0 && item.sizes.length > 0) {
                results.push(item);
                console.log(`✅ Adicionado: ${item.name} (ID: ${item.id})`);
            }
        }

        if (results.length > 0) {
            console.log(`📤 Enviando ${results.length} itens para o webhook...`);
            const response = await axios.post(WEBHOOK_URL, results);
            console.log(`✅ Webhook status: ${response.status}`);
        } else {
            console.log('❌ Nenhum produto novo com estoque encontrado.');
        }

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await browser.close();
    }
}

fetchFromIntelligentSearch();
