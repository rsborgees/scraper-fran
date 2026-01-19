const axios = require('axios');
const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');

// Main webhook from cronScheduler.js
const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

const productUrls = [
    'https://www.farmrio.com.br/saia-midi-jeans-com-pala-e-botacao-jeans-347124-0142/p',
    'https://www.farmrio.com.br/vestido-recorte-estampado-peixe-correnteza-peixe-correnteza_malha_vermelho-pitanga-351515-54137/p',
    'https://www.farmrio.com.br/macacao-jeans-pantalona-jeans-347079-0142/p'
];

async function sendItem(page, url) {
    console.log(`\n🚀 Processing: ${url}`);
    const product = await parseProduct(page, url);

    if (!product) {
        console.log(`❌ Failed to parse ${url}`);
        return false;
    }

    const caption = buildFarmMessage(product, null);

    const payload = {
        id: product.id,
        store: 'farm',
        image: product.imageUrl,
        caption: caption,
        price: product.precoAtual,
        original_price: product.precoOriginal,
        sizes: product.tamanhos ? product.tamanhos.join(',') : '',
        url: product.url,
        is_manual: true
    };

    console.log(`📤 Sending payload for: ${product.nome}`);
    console.log(`   Price: ${product.precoOriginal} -> ${product.precoAtual}`);

    try {
        const response = await axios.post(WEBHOOK_URL, payload);
        console.log(`✅ Success! Status: ${response.status}`);
        return true;
    } catch (err) {
        console.error(`❌ Webhook Error: ${err.message}`);
        return false;
    }
}

async function run() {
    const { browser, page } = await initBrowser();
    try {
        for (const url of productUrls) {
            await sendItem(page, url);
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (err) {
        console.error('Global Error:', err);
    } finally {
        await browser.close();
    }
}

run();
