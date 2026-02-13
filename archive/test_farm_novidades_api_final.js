const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const API_SEARCH_VESTIDOS = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search?fq=C:/2000003/2000021/&O=OrderByReleaseDateDESC';

async function testFarmNovidadesStable() {
    console.log('🚀 INICIANDO TESTE: FARM NOVIDADES (NODE FETCH FALLBACK)');

    try {
        console.log(`\n🔍 Buscando via API (Direct Node Request): ${API_SEARCH_VESTIDOS}`);

        // Use axios to get CLEAN JSON without browser prototype pollution
        const response = await axios.get(API_SEARCH_VESTIDOS, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            }
        });

        const productsJson = response.data;

        if (!productsJson || productsJson.length === 0) {
            console.error('❌ Nenhum produto retornado pela API.');
            return;
        }

        console.log(`\n✅ API retornou ${productsJson.length} produtos.`);

        const { browser, page } = await initBrowser();
        const products = [];
        const timerData = await checkFarmTimer();

        for (const pData of productsJson) {
            if (products.length >= 2) break;

            const url = pData.link;
            if (!url || typeof url !== 'string') {
                console.log('⚠️ Property link is not a string:', typeof url);
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

        await browser.close();

    } catch (error) {
        console.error('❌ Erro crítico no teste:', error.message);
    } finally {
        console.log('\n🏁 Teste finalizado.');
    }
}

testFarmNovidadesStable();
