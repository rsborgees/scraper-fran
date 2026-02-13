const { runDailyDriveSyncJob } = require('./cronScheduler');

console.log('🚀 Executando Job das 5 AM manualmente...\n');

runDailyDriveSyncJob()
    .then(() => {
        console.log('\n✅ Job das 5 AM concluído com sucesso!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Erro ao executar Job das 5 AM:', error);
        process.exit(1);
    });
