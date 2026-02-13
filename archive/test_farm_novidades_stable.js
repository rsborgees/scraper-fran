const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const API_SEARCH_VESTIDOS = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search?fq=C:/2000003/2000021/&O=OrderByReleaseDateDESC';

async function testFarmNovidadesStable() {
    console.log('🚀 INICIANDO TESTE: FARM NOVIDADES (FALLBACK VESTIDOS)');

    const { browser, page } = await initBrowser();

    try {
        console.log(`\n🔍 Buscando via API: ${API_SEARCH_VESTIDOS}`);

        const response = await page.goto(API_SEARCH_VESTIDOS);
        const text = await response.text();
        const productsJson = JSON.parse(text);

        if (!productsJson || productsJson.length === 0) {
            console.error('❌ Nenhum produto retornado pela API.');
            return;
        }

        console.log(`\n✅ API retornou ${productsJson.length} produtos.`);
        console.log('First item keys:', Object.keys(productsJson[0]));

        const products = [];
        const timerData = await checkFarmTimer();

        for (const pData of productsJson) {
            if (products.length >= 2) break;

            // Try to find the link property or linkText/productId again
            // In some environments, linkText might be 'slug' or something else
            const url = pData.link || (pData.linkText && pData.productId ? `https://www.farmrio.com.br/${pData.linkText}-${pData.productId}/p` : null);

            if (!url) {
                console.log('⚠️ Could not extract URL from item:', pData.productName);
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

testFarmNovidadesStable();
