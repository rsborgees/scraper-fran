const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
// Using C:/2000003/ which is often the "Novidades" or a major category for Farm
const API_SEARCH_NOVIDADES = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search?fq=C:/2000003/&O=OrderByReleaseDateDESC';

async function testFarmNovidadesStable() {
    console.log('🚀 INICIANDO TESTE: FARM NOVIDADES (BROWSER FETCH FALLBACK)');

    const { browser, page } = await initBrowser();

    try {
        console.log(`\n🔍 Buscando via API (Browser-side Fetch): ${API_SEARCH_NOVIDADES}`);

        // Use page.evaluate to perform a clean fetch inside the browser
        // This avoids Playwright's JSON corruption and handles cookies/CORS correctly
        const productsJson = await page.evaluate(async (apiUrl) => {
            const resp = await fetch(apiUrl);
            return await resp.json();
        }, API_SEARCH_NOVIDADES);

        if (!productsJson || productsJson.length === 0) {
            console.error('❌ Nenhum produto retornado pela API.');
            return;
        }

        console.log(`\n✅ API retornou ${productsJson.length} produtos. Analisando as primeiros 2 roupas em estoque...`);

        const products = [];
        const timerData = await checkFarmTimer();

        for (const pData of productsJson) {
            if (products.length >= 2) break;

            const url = pData.link;
            if (!url || typeof url !== 'string') {
                console.log('⚠️ URL missing or invalid in data.');
                continue;
            }

            console.log(`\n📄 Analisando: ${url}`);
            const product = await parseProduct(page, url);

            if (product) {
                console.log(`   ✅ Capturado: ${product.nome} (${product.categoria})`);
                products.push(product);
            }
        }

        if (products.length === 0) {
            console.error('❌ Nenhuma roupa válida em estoque encontrada.');
        } else {
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
                    const webhookResp = await axios.post(WEBHOOK_URL, payload);
                    console.log(`   ✅ Sucesso (${product.nome}): Status ${webhookResp.status}`);
                } catch (err) {
                    console.error(`   ❌ Erro Webhook (${product.nome}): ${err.message}`);
                }
            }
        }

    } catch (error) {
        console.error('❌ Erro crítico no teste:', error.message);
    } finally {
        await browser.close();
        console.log('\n🏁 Teste finalizado.');
    }
}

testFarmNovidadesStable();
