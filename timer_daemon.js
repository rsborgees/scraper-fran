const { checkFarmTimer } = require('./scrapers/farm/timer_check');

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

console.log('═══════════════════════════════════════════════════');
console.log('🕒 DAEMON DE MONITORAMENTO DE CRONÔMETRO INICIADO');
console.log(`Intervalo: 30 minutos`);
console.log('═══════════════════════════════════════════════════\n');

async function run() {
    try {
        await checkFarmTimer();
    } catch (err) {
        console.error('Erro no ciclo do daemon:', err.message);
    }

    console.log(`\nPróxima verificação em 30 minutos...`);
    setTimeout(run, INTERVAL_MS);
}

run();
