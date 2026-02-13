const { runDailyDriveSyncJob } = require('./cronScheduler');
require('dotenv').config();

async function test() {
    console.log('🧪 Testando runDailyDriveSyncJob...');

    // Sobrescrevendo o webhook para fins de teste se necessário
    // process.env.DRIVE_SYNC_WEBHOOK_URL_TEST = "https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook-test/fav-fran";

    try {
        await runDailyDriveSyncJob();
        console.log('\n✅ Teste concluído com sucesso!');
    } catch (err) {
        console.error('\n❌ Teste falhou:', err);
    }
}

test();
