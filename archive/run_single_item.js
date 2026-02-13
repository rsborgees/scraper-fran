const axios = require('axios');
const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');
const { appendQueryParams } = require('./urlUtils');

const WEBHOOK_URL = "https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/skraper-v2";
// const WEBHOOK_URL = "https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook-test/skraper-v2"; // Test url if needed

const TARGET_ID = '01342814';
const OVERRIDE_IMAGE_URL = 'https://drive.google.com/uc?export=download&id=1uYvIaVPE2ZNoe8F_A8_12flaZ135VI_r';

async function run() {
    console.log(`🚀 Iniciando envio manual do item ${TARGET_ID}...`);

    const { browser, page } = await initBrowser();

    try {
        // 1. Acessar página do produto para pegar dados (Search by ID or direct URL if known)
        // Tentando busca direta na Farm (buscando pelo ID no site geralmente funciona ou montando URL)
        // Como não temos a URL exata, vamos tentar pesquisar ou assumir uma busca.
        // Mas a user não deu URL, só ID. Vamos tentar achar via busca do site ou chutar URL. 
        // Melhor: Navegar Search.

        const possibleUrl = `https://www.farmrio.com.br/01342814`; // Muitas vezes funciona busca direta
        // Ou usar search: https://www.farmrio.com.br/busca/?q=01342814

        console.log(`🔎 Buscando dados do produto...`);
        const searchUrl = `https://www.farmrio.com.br/${TARGET_ID}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

        // Espera redirecionar ou carregar produto
        await page.waitForTimeout(5000);

        // Verifica se caiu numa página de produto (tem seletor de preço)
        const isProductPage = await page.$('.product-prices__value, .ns-product-price__value');

        if (!isProductPage) {
            console.log('⚠️ Página direta falhou. Tentando busca...');
            await page.goto(`https://www.farmrio.com.br/busca/?q=${TARGET_ID}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(5000);

            // Clicar no primeiro resultado
            const firstResult = await page.$('.shelf-product-name a, .product-item__name a');
            if (firstResult) {
                await firstResult.click();
                await page.waitForTimeout(5000);
            } else {
                throw new Error('Produto não encontrado na busca.');
            }
        }

        const currentUrl = page.url();
        console.log(`✅ Página do produto encontrada: ${currentUrl}`);

        const product = await parseProduct(page, currentUrl);

        if (!product) throw new Error('Falha ao fazer parse do produto.');

        console.log('📦 Dados originais capturados:', product.nome);

        // 2. Modificar dados conforme solicitado
        product.imagePath = OVERRIDE_IMAGE_URL; // Direct drive link as requested
        product.imageUrl = OVERRIDE_IMAGE_URL;
        product.loja = 'farm';
        product.url = appendQueryParams(product.url, { utm_campaign: "7B1313" });

        // Gera legenda
        const caption = buildFarmMessage(product, null); // Sem timer forçado

        // Payload
        const payload = {
            id: product.id,
            store: 'farm',
            image: product.imagePath,
            caption: caption,
            price: product.precoAtual,
            original_price: product.precoOriginal,
            installments: product.parcelamento,
            sizes: product.tamanhos ? product.tamanhos.join(',') : '',
            url: product.url,
            is_manual: true
        };

        console.log('📤 Enviando para Webhook...');
        console.log('   Image:', payload.image);
        console.log('   Caption Preview:', payload.caption.split('\n')[0]);

        const response = await axios.post(WEBHOOK_URL, payload);
        console.log(`✅ Sucesso! Status: ${response.status}`);
        console.log('Resposta:', response.data);

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await browser.close();
    }
}

run();
