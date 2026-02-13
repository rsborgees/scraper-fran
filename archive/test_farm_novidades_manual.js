const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

async function testFarmNovidadesManual() {
    console.log('🚀 INICIANDO TESTE: FARM NOVIDADES (FALLBACK URLs)');

    const { browser, page } = await initBrowser();

    try {
        // I will use 2 recent IDs that are typically in stock
        // These are from the front page "Novidades" section right now
        const candidates = [
            'https://www.farmrio.com.br/vestido-midi-estampado-floral-fresco-floral-fresco-343583-53744/p',
            'https://www.farmrio.com.br/blusa-regata-jeans-ampla-jeans-347101-0142/p'
        ];

        console.log(`\n🔎 Analisando ${candidates.length} produtos...`);

        const products = [];
        const timerData = await checkFarmTimer();

        for (const url of candidates) {
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

testFarmNovidadesManual();
