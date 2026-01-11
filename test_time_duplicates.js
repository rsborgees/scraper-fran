const { isDuplicate, loadHistory } = require('./historyManager');

console.log('🧪 Testando filtro de duplicados baseado em tempo...\n');

// 1. Testar migração
console.log('1️⃣ Testando migração automática do history.json...');
const history = loadHistory();
console.log(`   Total de IDs no histórico: ${Object.keys(history).length}`);
console.log(`   Formato: ${Object.keys(history).length > 0 ? 'Objeto com timestamps ✅' : 'Vazio'}`);

if (Object.keys(history).length > 0) {
    const sampleId = Object.keys(history)[0];
    console.log(`   Exemplo: ${sampleId} =`, history[sampleId]);
}

console.log('\n2️⃣ Testando lógica de duplicados...');

// Testar ID que existe
console.log('\n   Teste A: ID que existe no histórico (deve ser duplicado)');
const existingId = Object.keys(history)[0];
if (existingId) {
    console.log(`   Testando ID: ${existingId}`);
    const isDup = isDuplicate(existingId);
    console.log(`   Resultado: ${isDup ? '🚫 Duplicado (correto)' : '❌ NÃO duplicado (ERRO!)'}`);
}

// Testar ID que não existe
console.log('\n   Teste B: ID novo (não deve ser duplicado)');
const newId = '999999999';
console.log(`   Testando ID: ${newId}`);
const isNew = isDuplicate(newId);
console.log(`   Resultado: ${isNew ? '❌ Duplicado (ERRO!)' : '✅ Não duplicado (correto)'}`);

console.log('\n✅ Teste concluído!');
console.log('\n💡 Para testar IDs expirados, modifique manualmente o timestamp no history.json');
console.log('   Ex: "350140": { "timestamp": 1000000000000, ... }  // timestamp muito antigo');
