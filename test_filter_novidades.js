const { distributeLinks } = require('./distributionEngine');

// Fake products to test distribution engine filtering
const fakeProducts = [
    { id: '1', loja: 'farm', nome: 'Farm Regular', bazar: false, isFavorito: false, novidade: false },
    { id: '2', loja: 'farm', nome: 'Farm Novidade', bazar: false, isFavorito: false, novidade: true },
    { id: '3', loja: 'farm', nome: 'Farm Favorito', bazar: false, isFavorito: true, novidade: false },
    { id: '4', loja: 'farm', nome: 'Farm Bazar', bazar: true, isFavorito: false, novidade: false },
    { id: '5', loja: 'dressto', nome: 'DressTo Regular', bazar: false, isFavorito: false, novidade: false },
    { id: '6', loja: 'dressto', nome: 'DressTo Favorito', bazar: false, isFavorito: true, novidade: false },
    { id: '7', loja: 'live', nome: 'Live Novidade', bazar: false, favorito: false, isNovidade: true },
    { id: '8', loja: 'zzmall', nome: 'ZZMall Regular', bazar: false, favorito: false, isNovidade: false },
    ...Array.from({length: 10}, (_, i) => ({ id: `10${i}`, loja: 'farm', nome: `Farm Filler ${i}` }))
];

const quotas = {
    farm: 7,
    dressto: 2,
    kju: 1,
    live: 1,
    zzmall: 1
};

const remaining = {
    stores: {
        farm: 100,
        dressto: 100,
        kju: 100,
        live: 100,
        zzmall: 100
    }
};

const result = distributeLinks(fakeProducts, quotas, remaining);

console.log(`\n\n=== RESULTADO DA DISTRIBUIÇÃO ===\n`);
console.log(`Total selecionado: ${result.length}`);
result.forEach(p => {
    console.log(`- [${p.loja}] ${p.nome} (Favorito/Novidade/Bazar: ${p.isFavorito||p.favorito}/${p.novidade||p.isNovidade}/${p.bazar})`);
});

const containsFavOrNov = result.some(p => p.isFavorito || p.favorito || p.novidade || p.isNovidade);
console.log(`\nContém favoritos ou novidades? ${containsFavOrNov ? '❌ FALHOU (SIM)' : '✅ PASSOU (NÃO)'}`);
