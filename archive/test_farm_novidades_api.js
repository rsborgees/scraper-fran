const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
// Using C:/2000003/ which is often the "Novidades" or a major category for Farm
const API_SEARCH_NOVIDADES = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search?fq=C:/2000003/&O=OrderByReleaseDateDESC';

async function testFarmNovidadesApi() {
    console.log('🚀 INICIANDO TESTE: FARM NOVIDADES (VIA API VTEX)');

    const { browser, page } = await initBrowser();

    try {
        console.log(`\n🔍 Buscando novidades via API: ${API_SEARCH_NOVIDADES}`);

        const response = await page.goto(API_SEARCH_NOVIDADES);
        const text = await response.text();

        // Manual JSON parse to avoid prototype pollution from browser context
        const productsJson = JSON.parse(text);

        if (!productsJson || productsJson.length === 0) {
            console.error('❌ Nenhum produto retornado pela API.');
            return;
        }

        console.log(`\n✅ API retornou ${productsJson.length} produtos. Filtrando as primeiros 2 roupas em estoque...`);

        const products = [];
        const timerData = await checkFarmTimer();

        for (const pData of productsJson) {
            if (products.length >= 2) break;

            const url = pData.link;
            if (!url || typeof url !== 'string') {
                console.log('⚠️ Invalid URL in JSON data, skipping.');
                continue;
            }

            console.log(`\n📄 Analisando: ${url}`);

            const product = await parseProduct(page, url);

            if (product) {
                // Filtro de categorias proibidas
                const forbiddenCategories = ['acessório', 'mala', 'bolsa', 'banho', 'utilitário/casa', 'desconhecido'];
                if (forbiddenCategories.includes(product.categoria)) {
                    console.log(`   🚫 Descartado (Categoria): ${product.categoria}`);
                    continue;
                }

                console.log(`   ✅ Capturado: ${product.nome} (${product.categoria})`);
                products.push(product);
            }
        }

        if (products.length === 0) {
            console.error('❌ Nenhuma roupa válida em estoque encontrada.');
            return;
        }

        // 2. Build and Send messages
        console.log(`\n📤 Enviando ${products.length} produtos para o webhook...`);

        for (const product of products) {
            const caption = buildFarmMessage(product, timerData);

            const payload = {
                id: product.id,
                store: 'farm',
                image: product.imagePath || product.imageUrl,
                caption: caption,
                price: product.precoAtual,
                original_price: product.precoOriginal,
                sizes: product.tamanhos ? product.tamanhos.join(',') : '',
                url: product.url,
                is_manual: true,
                isNovidade: true
            };

            try {
                const response = await axios.post(WEBHOOK_URL, payload);
                console.log(`   ✅ Sucesso (${product.nome}): Status ${response.status}`);
            } catch (err) {
                console.error(`   ❌ Erro Webhook (${product.nome}): ${err.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Erro crítico no teste:', error);
    } finally {
        await browser.close();
        console.log('\n🏁 Teste finalizado.');
    }
}

testFarmNovidadesApi();
