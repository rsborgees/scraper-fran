const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const STABLE_CAT_URL = 'https://www.farmrio.com.br/vestidos';

async function testFarmNovidadesDOM() {
    console.log('🚀 INICIANDO TESTE: FARM NOVIDADES (DOM SCRAPE VESTIDOS)');

    const { browser, page } = await initBrowser();

    try {
        console.log(`🌐 Navegando para: ${STABLE_CAT_URL}`);
        await page.goto(STABLE_CAT_URL, { waitUntil: 'networkidle', timeout: 60000 });

        // Give enough time for the grid to render
        await page.waitForTimeout(5000);

        console.log('🔎 Buscando links de produtos na página...');
        const productUrls = await page.evaluate(() => {
            // Looking for standard VTEX PDP links
            const anchors = Array.from(document.querySelectorAll('a[href*="/p"]'));
            const links = anchors
                .map(a => a.href)
                .filter(href => {
                    // Filter out non-product links and duplicates
                    return (href.includes('/p?') || href.includes('/p/') || href.endsWith('/p')) &&
                        !href.includes('account') && !href.includes('cart') && !href.includes('wishlist');
                });
            return [...new Set(links)];
        });

        if (productUrls.length === 0) {
            console.error('❌ Nenhum link de produto encontrado no DOM.');
            return;
        }

        console.log(`✅ Encontrados ${productUrls.length} links. Analisando os primeiros 2...`);

        const products = [];
        const timerData = await checkFarmTimer();

        for (const url of productUrls) {
            if (products.length >= 2) break;

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

testFarmNovidadesDOM();
