
const { runDailyDriveSyncJob } = require('./cronScheduler');
require('dotenv').config();

// Override the webhook send to just console.log the payload
const axios = require('axios');
const originalPost = axios.post;
axios.post = async (url, data, config) => {
    if (url.includes('webhook')) {
        console.log(`📡 [MOCK] Webhook call to: ${url}`);
        console.log(`📦 Payload size: ${JSON.stringify(data).length}`);
        console.log(`📊 Summary:`, data.summary);

        const match = data.products.find(p => p.id.includes('363187') || p.nome.includes('363187'));
        if (match) {
            console.log('✅ FOUND 363187 in payload!');
        } else {
            console.log('❌ 363187 NOT in payload.');
        }
        return { status: 200, data: { success: true } };
    }
    return originalPost(url, data, config);
};

async function run() {
    console.log('🚀 Starting 5 AM Job Simulation...');
    await runDailyDriveSyncJob();
    console.log('🏁 Simulation complete.');
}

run();
