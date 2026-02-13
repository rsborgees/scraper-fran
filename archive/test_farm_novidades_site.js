const { initBrowser } = require('./browser_setup');
const { scanCategory } = require('./scrapers/farm/scanner');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const NOVIDADES_URL = 'https://www.farmrio.com.br/novidades';

async function testFarmNovidadesSite() {
    console.log('🚀 INICIANDO TESTE: FARM NOVIDADES (SITE DIRECT)');

    const { browser, page } = await initBrowser();

    try {
        // Since the Novidades page is currently dynamic/SPA and doesn't show links in the initial HTML
        // we will use hardcoded URLs to verify the parsing and sending logic as requested.
        const candidates = [
            'https://www.farmrio.com.br/vestido-longo-estampado-praia-de-poa-praia-de-poa-345091-53697/p',
            'https://www.farmrio.com.br/vestido-midi-estampado-floral-fresco-floral-fresco-343583-53744/p'
        ];

        console.log(`\n🔎 Usando ${candidates.length} URLs fixas para teste de parsing e envio...`);

        const products = [];
        const timerData = await checkFarmTimer();

        for (const url of candidates) {
            if (products.length >= 2) break;

            console.log(`\n📄 Analisando: ${url}`);
            const product = await parseProduct(page, url);

            if (product) {
                // Filtro de categorias proibidas (mesmo do index.js)
                const forbiddenCategories = ['acessório', 'mala', 'bolsa', 'banho', 'utilitário/casa', 'desconhecido'];
                if (forbiddenCategories.includes(product.categoria)) {
                    console.log(`   🚫 Descartado (Categoria): ${product.categoria}`);
                    continue;
                }

                console.log(`   ✅ Capturado: ${product.nome} (${product.categoria})`);
                products.push(product);
            }

            // Pequeno delay para evitar bloqueios
            await new Promise(r => setTimeout(r, 1000));
        }

        if (products.length === 0) {
            console.error('❌ Nenhuma roupa válida encontrada.');
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

testFarmNovidadesSite();
