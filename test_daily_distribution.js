const { distributeLinks } = require('./distributionEngine');

// Mock data
const brands = ['FARM', 'DRESS', 'KJU', 'ZZMALL', 'LIVE'];
const categories = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'acessórios'];

function createProduct(id, brand, isFavorito = false, novidade = false, bazar = false, categoria = 'vestido') {
    return {
        id: String(id),
        nome: `${brand} Product ${id}`,
        brand: brand.toUpperCase(),
        loja: brand.toLowerCase(),
        favorito: isFavorito,
        isFavorito: isFavorito,
        novidade: novidade,
        isNovidade: novidade,
        bazar: bazar,
        categoria: categoria,
        precoAtual: 100,
        precoOriginal: 200,
        tamanhos: ['P', 'M', 'G']
    };
}

let allProducts = [];
let idCounter = 1;

// Categorias Farm para teste de sub-cotas (60/25/15)
// Meta por rodada ~3-4 Farm. 60% de 4 = 2.4 (2), 25% de 4 = 1.0 (1), 15% de 4 = 0.6 (1)
for (let i = 0; i < 20; i++) allProducts.push(createProduct(idCounter++, 'FARM', false, false, false, 'vestido'));
for (let i = 0; i < 10; i++) allProducts.push(createProduct(idCounter++, 'FARM', false, false, false, 'macacão'));
for (let i = 0; i < 10; i++) allProducts.push(createProduct(idCounter++, 'FARM', false, false, false, 'blusa'));
for (let i = 0; i < 5; i++) allProducts.push(createProduct(idCounter++, 'FARM', false, false, true, 'vestido')); // Bazar Farm

// Favoritos e Novidades (devem ser ignorados)
for (let i = 0; i < 5; i++) allProducts.push(createProduct(idCounter++, 'FARM', true, false, false, 'vestido'));
for (let i = 0; i < 5; i++) allProducts.push(createProduct(idCounter++, 'FARM', false, true, false, 'vestido'));

// Other Brands
brands.slice(1).forEach(brand => {
    for (let i = 0; i < 10; i++) allProducts.push(createProduct(idCounter++, brand));
    for (let i = 0; i < 2; i++) allProducts.push(createProduct(idCounter++, brand, false, false, true)); // Bazar others
});

console.log(`Pool inicial: ${allProducts.length} itens.`);

// Teste 1: Uma única execução
const selection = distributeLinks(allProducts);

console.log('\n--- RESULTADO TESTE 1 (Single Run) ---');
console.log(`Itens selecionados: ${selection.length}`);

const hasFavoritos = selection.some(p => p.favorito || p.isFavorito);
const hasNovidades = selection.some(p => p.novidade || p.isNovidade);
const bazarItems = selection.filter(p => p.bazar);

console.log(`- Contém favoritos? ${hasFavoritos ? '❌ SIM (Erro)' : '✅ Não'}`);
console.log(`- Contém novidades? ${hasNovidades ? '❌ SIM (Erro)' : '✅ Não'}`);
console.log(`- Quantidade de Bazar: ${bazarItems.length} (Esperado: 1) -> ${bazarItems.length === 1 ? '✅' : '❌'}`);

const farmItems = selection.filter(p => p.loja === 'farm');
const farmVestidos = farmItems.filter(p => p.categoria === 'vestido');
const farmMacacoes = farmItems.filter(p => p.categoria === 'macacão');

console.log(`- Farm: ${farmItems.length} itens.`);
console.log(`  - Vestidos: ${farmVestidos.length}`);
console.log(`  - Macacões: ${farmMacacoes.length}`);

// Teste 2: Simulação de stats persistentes (opcional aqui, mas vamos verificar se distributeLinks é consistente)
const selection2 = distributeLinks(allProducts.filter(p => !selection.some(s => s.id === p.id)));
console.log('\n--- RESULTADO TESTE 2 (Segunda Execução) ---');
console.log(`Itens selecionados: ${selection2.length}`);
console.log(`- Quantidade de Bazar: ${selection2.filter(p => p.bazar).length} (Esperado: 1)`);

if (!hasFavoritos && !hasNovidades && bazarItems.length === 1) {
    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
} else {
    console.log('\n❌ TESTE FALHOU!');
}
