const { distributeLinks } = require('./distributionEngine');

// Mock data
const mockProducts = [
    { id: 'F1', nome: 'Farm 1', loja: 'farm', bazar: false },
    { id: 'F2', nome: 'Farm 2', loja: 'farm', bazar: false },
    { id: 'F3', nome: 'Farm 3', loja: 'farm', bazar: false },
    { id: 'F4', nome: 'Farm 4', loja: 'farm', bazar: false },
    { id: 'F5', nome: 'Farm 5', loja: 'farm', bazar: false },
    { id: 'B1', nome: 'Bazar Farm', loja: 'farm', bazar: true },
    { id: 'D1', nome: 'Dress 1', loja: 'dressto', bazar: false },
    { id: 'D2', nome: 'Dress 2', loja: 'dressto', bazar: false },
    { id: 'D3', nome: 'Dress 3', loja: 'dressto', bazar: false },
    { id: 'K1', nome: 'Kju 1', loja: 'kju', bazar: false },
    { id: 'K2', nome: 'Kju 2', loja: 'kju', bazar: false },
    { id: 'Z1', nome: 'ZZ 1', loja: 'zzmall', bazar: false }
];

const quotas = { farm: 4, dressto: 2, kju: 1, zzmall: 0 };
const remaining = { stores: { farm: 10, dressto: 10, kju: 10, live: 10, zzmall: 10 } };

console.log('\n--- 🧪 TESTANDO DISTRIBUIÇÃO 4-2-1 (COM BAZAR) ---');
const selected = distributeLinks(mockProducts, quotas, remaining);

console.log('\nItems Selecionados:');
selected.forEach((p, i) => {
    console.log(`${i + 1}. ${p.nome} (${p.loja}) - Bazar: ${p.bazar}`);
});

console.log('\n--- 📊 RESULTADO ---');
const counts = selected.reduce((acc, p) => {
    acc[p.loja] = (acc[p.loja] || 0) + 1;
    return acc;
}, {});

console.log('Contagem por loja:', counts);
const isCorrect = (counts.farm === 4 && counts.dressto === 2 && counts.kju === 1);
if (isCorrect) {
    console.log('✅ SUCESSO: Quotas 4-2-1 respeitadas!');
} else {
    console.log('❌ FALHA: Quotas incorretas.');
}

if (selected.length === 7) {
    console.log('✅ SUCESSO: Total de 7 itens.');
} else {
    console.log(`❌ FALHA: Total de ${selected.length} itens.`);
}

const hasBazar = selected.some(p => p.bazar);
console.log(hasBazar ? '✅ Bazar incluído.' : '❌ Bazar ausente.');

// Teste Intercalação (Variedade)
console.log('\nVerificando Sequência (Variedade):');
const sequence = selected.map(p => p.loja);
console.log(sequence.join(' -> '));
