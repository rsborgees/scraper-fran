
const { runDailyDriveSyncJob } = require('./cronScheduler');
require('dotenv').config();

async function run() {
    console.log('🚀 Running REAL 5 AM Job logic (Real Webhook)...');
    try {
        await runDailyDriveSyncJob();
        console.log('✅ Job completed successfully.');
    } catch (e) {
        console.error('❌ Job FAILED:', e.message);
    }
}

run();
