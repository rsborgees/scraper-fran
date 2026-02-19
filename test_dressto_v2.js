
require('dotenv').config();
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildDressMessage } = require('./messageBuilder');
const axios = require('axios');

// Using the same URL as cronScheduler.js -> WEBHOOK_URL
const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

async function sendTestPayload(products) {
    const payload = {
        timestamp: new Date().toISOString(),
        totalProducts: products.length,
        products: products,
        summary: {
            farm: products.filter(p => p.loja === 'farm').length,
            dressto: products.filter(p => p.loja === 'dressto').length,
            kju: products.filter(p => p.loja === 'kju').length,
            live: products.filter(p => p.loja === 'live').length,
            zzmall: products.filter(p => p.loja === 'zzmall').length
        }
    };

    console.log(`\n📤 Enviando payload para: ${WEBHOOK_URL}`);
    console.log(`📦 Payload: ${JSON.stringify(payload, null, 2).substring(0, 500)}...`);

    try {
        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        });
        console.log(`✅ Webhook status: ${response.status}`);
        console.log(`✅ Webhook response: ${JSON.stringify(response.data)}`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao enviar para webhook: ${error.message}`);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data)}`);
        }
        return false;
    }
}

async function test() {
    console.log('🧪 Iniciando NOVO teste manual Dress To (Drive-First)...');

    const driveItem = {
        id: '01332575',
        driveId: '01332575',
        driveUrl: 'https://drive.google.com/uc?export=download&id=1uymT87cmn6aW_XoPg3hxvibRE9grTVNA',
        isFavorito: false,
        novidade: true,
        store: 'dressto'
    };

    const { browser, context } = await initBrowser();

    try {
        const result = await scrapeSpecificIdsGeneric(context, [driveItem], 'dressto', 1, { maxAgeHours: -1 });

        if (result.products.length > 0) {
            const product = result.products[0];
            product.message = buildDressMessage(product);

            // Garantir campos que o distributionEngine/webhook costuma esperar
            product.loja = 'dressto';
            product.isDriveItem = true;

            const success = await sendTestPayload([product]);
            if (success) {
                console.log('\n🚀 O item deve ter chegado no webhook agora!');
            }
        } else {
            console.log('❌ Falha ao capturar o produto.');
        }

    } catch (error) {
        console.error('❌ Erro durante o teste:', error);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

test();
