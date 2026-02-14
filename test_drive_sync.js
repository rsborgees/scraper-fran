/**
 * Teste Manual do Drive Sync Job
 * Simula a execução do job das 5h para diagnosticar problemas
 */

require('dotenv').config();
const { runDailyDriveSyncJob } = require('./cronScheduler');

console.log('🧪 TESTE MANUAL DO DRIVE SYNC JOB');
console.log('='.repeat(60));
console.log('Este teste simula a execução do job das 5h da manhã.');
console.log('Aguarde enquanto processamos os itens do Drive...\n');

runDailyDriveSyncJob()
    .then(() => {
        console.log('\n✅ Teste concluído com sucesso!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Erro no teste:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
