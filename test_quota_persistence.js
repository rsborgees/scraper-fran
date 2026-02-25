const { recordSentItems, getRemainingQuotas, resetIfNewDay, saveStats } = require('./dailyStatsManager');
const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, 'data', 'daily_stats.json');

// Mock products
const p1 = { loja: 'farm', brand: 'farm', categoria: 'vestido', bazar: false };
const p2 = { loja: 'farm', brand: 'farm', categoria: 'macacão', bazar: true };
const p3 = { loja: 'live', brand: 'live', categoria: 'calça', bazar: false };

console.log('--- TEST: DAILY STATS MANAGER ---');

// 1. Reset Stats
console.log('1. Resetando stats...');
resetIfNewDay();

// 2. Record items
console.log('2. Registrando 3 itens (Vestido Farm, Bazar Farm, Live)...');
recordSentItems([p1, p2, p3]);

// 3. Check remaining
let remaining = getRemainingQuotas();
console.log('3. Quotas restantes:');
console.log(`   - Total: ${remaining.total} (Esperado: 153) -> ${remaining.total === 153 ? '✅' : '❌'}`);
console.log(`   - Farm: ${remaining.stores.farm} (Esperado: 44) -> ${remaining.stores.farm === 44 ? '✅' : '❌'}`);
console.log(`   - Farm Vestidos: ${remaining.farmCategories.vestido} (Esperado: 27) -> ${remaining.farmCategories.vestido === 27 ? '✅' : '❌'}`);
console.log(`   - Farm Macacões: ${remaining.farmCategories.macacão} (Esperado: 11) -> ${remaining.farmCategories.macacão === 11 ? '✅' : '❌'}`);

// 4. Test New Day reset (Mock date)
console.log('\n4. Testando reset de novo dia (Mocking data antiga)...');
const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
stats.date = '2020-01-01';
fs.writeFileSync(STATS_FILE, JSON.stringify(stats));

const newStats = resetIfNewDay();
const today = new Date().toISOString().split('T')[0];
console.log(`   - Data resetada para hoje? ${newStats.date === today ? '✅' : '❌'}`);
console.log(`   - Total resetado para 0? ${newStats.total === 0 ? '✅' : '❌'}`);

if (remaining.total === 153 && newStats.total === 0) {
    console.log('\n✅ TESTE DE PERSISTÊNCIA OK!');
} else {
    console.log('\n❌ TESTE DE PERSISTÊNCIA FALHOU!');
    process.exit(1);
}
