const axios = require('axios');
const { initBrowser } = require('./browser_setup');
const { parseProductKJU } = require('./scrapers/kju/index');
const { buildKjuMessage } = require('./messageBuilder');

const WEBHOOK_URL = "https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa";

const LISTING_URL = 'https://www.kjubrasil.com/acessorios/?ref=7B1313';

async function run() {
    console.log(`🚀 Iniciando envio de 3 produtos KJU...`);

    const { browser, page } = await initBrowser();

    try {
        console.log(`🔎 Navegando para listagem: ${LISTING_URL}`);
        await page.goto(LISTING_URL, { waitUntil: 'load', timeout: 60000 });

        // Wait for products
        try {
            await page.waitForSelector('.produtos .item a, .prod a, a.b_acao', { timeout: 15000 });
        } catch (e) { console.log('Timeout waiting for selector, trying to continue...'); }

        // Extract URLs
        const productUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('.produtos .item a, .prod a, a.b_acao'));
            return [...new Set(links.map(a => a.href))]
                .filter(url => {
                    const path = new URL(url).pathname;
                    if (path === '/' || path === '') return false;
                    const isSystem = ['/carrinho', '/checkout', '/conta', '/atendimento', '/politica', '/troca', '/ajuda', '/contato', '/quem-somos'].some(s => path.includes(s));
                    const isCategory = ['/categoria/', '/selo/', '/colecao/', '/novidades/', '/loja/', '/acessorios/'].some(s => path.includes(s));
                    return !isSystem && !isCategory && path.length > 15;
                });
        });

        console.log(`Found ${productUrls.length} products. Processing top 3...`);
        const targetUrls = productUrls.slice(0, 3);

        for (const [index, url] of targetUrls.entries()) {
            console.log(`\n📦 [${index + 1}/3] Processing: ${url}`);

            try {
                const product = await parseProductKJU(page, url);

                if (!product) {
                    console.log('❌ Falha ao parsear produto. Pulando...');
                    continue;
                }

                console.log(`✅ Dados capturados: ${product.nome} | R$${product.precoAtual}`);

                // Gera legenda
                const caption = buildKjuMessage(product);

                // Payload
                const payload = {
                    id: product.id || 'kju-manual-' + Date.now(),
                    store: 'kju',
                    image: product.imagePath || 'https://via.placeholder.com/300',
                    caption: caption,
                    price: product.precoAtual,
                    original_price: product.precoOriginal,
                    sizes: product.tamanhos ? product.tamanhos.join(',') : '',
                    url: product.url,
                    is_manual: true
                };

                // Fallback image grab if missing
                if (!payload.image || payload.image.includes('placeholder')) {
                    const imgUrl = await page.evaluate(() => {
                        const img = document.querySelector('.zoom, #zoom_01, .imagem-produto img');
                        return img ? img.src : null;
                    });
                    if (imgUrl) payload.image = imgUrl;
                }

                console.log('📤 Enviando para Webhook...');
                console.log('   Preview:', product.nome);

                const response = await axios.post(WEBHOOK_URL, payload);
                console.log(`✅ Sucesso! Status: ${response.status}`);

            } catch (err) {
                console.error(`❌ Erro no item ${index + 1}:`, err.message);
            }

            // Short delay
            await page.waitForTimeout(2000);
        }

    } catch (err) {
        console.error('❌ Erro Fatal:', err.message);
    } finally {
        await browser.close();
    }
}

run();
