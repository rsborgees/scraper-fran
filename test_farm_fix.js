
const { distributeLinks } = require('./distributionEngine');

// Mock products
const products = [
    // FARM
    { id: 'F1', loja: 'farm', nome: 'Bazar 1', bazar: true },
    { id: 'F2', loja: 'farm', nome: 'Bazar 2', bazar: true },
    { id: 'F3', loja: 'farm', nome: 'Normal 1' },
    { id: 'F4', loja: 'farm', nome: 'Normal 2' },
    { id: 'F5', loja: 'farm', nome: 'Normal 3' },
    { id: 'F6', loja: 'farm', nome: 'Normal 4' },
    { id: 'F7', loja: 'farm', nome: 'Normal 5' },
    { id: 'F8', loja: 'farm', nome: 'Normal 6' },
    { id: 'F9', loja: 'farm', nome: 'Normal 7' },
    { id: 'F10', loja: 'farm', nome: 'Favorito', favorito: true },
    { id: 'F11', loja: 'farm', nome: 'Novidade', novidade: true },

    // Others to fill quota
    { id: 'D1', loja: 'dressto', nome: 'Dress 1' },
    { id: 'D2', loja: 'dressto', nome: 'Dress 2' },
    { id: 'K1', loja: 'kju', nome: 'Kju 1' },
    { id: 'L1', loja: 'live', nome: 'Live 1' }
];

const runQuotas = { farm: 7, dressto: 2, kju: 1, live: 1 };
const dailyRemaining = { stores: { farm: 50, dressto: 20, kju: 10, live: 10, zzmall: 10 } };

console.log('🧪 Testando Distribuição FARM...');
const result = distributeLinks(products, runQuotas, dailyRemaining);

const farmItems = result.filter(p => p.loja === 'farm');
const bazars = farmItems.filter(p => p.bazar);
const normals = farmItems.filter(p => !p.bazar && !p.favorito && !p.novidade);
const favs = farmItems.filter(p => p.favorito || p.novidade);

console.log(`\n📊 Resultado FARM (${farmItems.length} itens):`);
console.table(farmItems.map(p => ({ ID: p.id, Nome: p.nome, Bazar: !!p.bazar, Regular: !p.bazar && !p.favorito && !p.novidade })));

console.log(`\n✅ Bazars: ${bazars.length} (Esperado: 1)`);
console.log(`✅ Normais: ${normals.length} (Esperado: 6)`);
console.log(`✅ Favoritos/Novidades: ${favs.length} (Esperado: 0)`);

if (bazars.length === 1 && normals.length === 6 && favs.length === 0) {
    console.log('\n✨ TESTE PASSOU!');
} else {
    console.error('\n❌ TESTE FALHOU!');
    process.exit(1);
}
