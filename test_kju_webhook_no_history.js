require('dotenv').config();
const { scrapeKJU } = require('./scrapers/kju');
const { sendToWebhook } = require('./cronScheduler');
const { buildKjuMessage } = require('./messageBuilder');

async function testWebhookNoHistory() {
    console.log('🚀 Starting KJU Webhook Test (No History)');
    console.log('   Quota: 3 items');

    try {
        const products = await scrapeKJU(3);

        if (products.length === 0) {
            console.log('❌ No products found.');
            return;
        }

        console.log(`\n📦 Collected ${products.length} items. Building messages...`);

        products.forEach(p => {
            p.message = buildKjuMessage(p);
            console.log(`   - ${p.nome} (Message built)`);
        });

        console.log('\n📤 Sending to webhook...');
        const result = await sendToWebhook(products);

        console.log('\n✅ Test Result:', result);

    } catch (e) {
        console.error('❌ Error during test:', e);
    }
}

testWebhookNoHistory();
