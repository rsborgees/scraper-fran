const axios = require('axios');
const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

async function run() {
    const { browser, page } = await initBrowser();
    try {
        console.log('🔎 Searching for new arrivals via API...');
        await page.goto('https://www.farmrio.com.br/api/catalog_system/pub/products/search?O=OrderByReleaseDateDESC');
        const content = await page.evaluate(() => document.body.innerText);
        const products = JSON.parse(content);

        if (products && products.length > 0) {
            // Pick a product that is likely in stock
            for (let i = 0; i < 5; i++) {
                const url = products[i].link;
                console.log(`\n🚀 Processing: ${url}`);
                const product = await parseProduct(page, url);

                if (product) {
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
                    const response = await axios.post(WEBHOOK_URL, payload);
                    console.log(`✅ Success! Status: ${response.status}`);
                    break;
                } else {
                    console.log('❌ Item out of stock or failed to parse, trying next...');
                }
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
    }
}

run();
