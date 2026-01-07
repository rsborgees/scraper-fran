const { runDailyPromoJob } = require('./cronScheduler');

console.log('🧪 Iniciando TESTE MANUAL do Daily Promo Job...');
console.log('Isso vai gerar a copy e enviar para o Webhook real.');
console.log('Aguarde...\n');

runDailyPromoJob()
    .then(() => console.log('\n✅ Teste finalizado!'))
    .catch(err => console.error('\n❌ Erro no teste:', err));
