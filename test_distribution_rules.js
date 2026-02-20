const { distributeLinks } = require('./distributionEngine');

// Mock data
const brands = ['FARM', 'DRESS', 'KJU', 'ZZMALL', 'LIVE'];
const categories = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'acessórios'];

/**
 * Creates a mock product
 */
function createProduct(id, brand, isSiteNovidade = false, bazar = false, categoria = 'vestido') {
    return {
        id: String(id),
        nome: `${brand} Product ${id}`,
        brand: brand,
        loja: brand.toLowerCase(),
        isSiteNovidade: isSiteNovidade,
        bazar: bazar,
        categoria: categoria,
        precoAtual: 100,
        precoOriginal: 200,
        tamanhos: ['P', 'M', 'G']
    };
}

let allProducts = [];
let idCounter = 1;

// 1. Create Farm Pool
// 3 Site Novidades
for (let i = 0; i < 3; i++) allProducts.push(createProduct(idCounter++, 'FARM', true, false));
// 5 Bazar
for (let i = 0; i < 5; i++) allProducts.push(createProduct(idCounter++, 'FARM', false, true));
// 10 Regular (various categories)
categories.forEach(cat => {
    for (let i = 0; i < 3; i++) allProducts.push(createProduct(idCounter++, 'FARM', false, false, cat));
});

// 2. Other Brands
brands.slice(1).forEach(brand => {
    for (let i = 0; i < 10; i++) allProducts.push(createProduct(idCounter++, brand));
});

console.log(`Total Pool Size: ${allProducts.length}`);

// Run distribution
const selection = distributeLinks(allProducts);

console.log('\n--- DISTRIBUTION RESULT ---');
console.log(`Selection Size: ${selection.length}`);

const stats = selection.reduce((acc, p) => {
    const brand = (p.brand || p.loja).toUpperCase();
    if (!acc[brand]) acc[brand] = { total: 0, siteNovidade: 0, bazar: 0, categories: {} };
    acc[brand].total++;
    if (p.isSiteNovidade) acc[brand].siteNovidade++;
    if (p.bazar) acc[brand].bazar++;
    if (!acc[brand].categories[p.categoria]) acc[brand].categories[p.categoria] = 0;
    acc[brand].categories[p.categoria]++;
    return acc;
}, {});

console.table(Object.entries(stats).map(([brand, data]) => ({
    Brand: brand,
    Total: data.total,
    SiteNovidade: data.siteNovidade,
    Bazar: data.bazar,
    TopCategory: Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0]?.[0]
})));

// Summary checks
const farm = stats['FARM'] || { total: 0, siteNovidade: 0, bazar: 0 };
console.log('\nFARM Checks:');
console.log(`- Total: ${farm.total} (Expected: 6) -> ${farm.total === 6 ? '✅' : '❌'}`);
console.log(`- Site Novidade: ${farm.siteNovidade} (Expected: 1) -> ${farm.siteNovidade === 1 ? '✅' : '❌'}`);
console.log(`- Bazar: ${farm.bazar} (Expected: 1) -> ${farm.bazar === 1 ? '✅' : '❌'}`);
console.log(`- Regular: ${farm.total - farm.siteNovidade - farm.bazar} (Expected: 4) -> ${farm.total - farm.siteNovidade - farm.bazar === 4 ? '✅' : '❌'}`);

const live = stats['LIVE'] || { total: 0 };
console.log('\nLIVE Check:');
console.log(`- Total: ${live.total} (Expected: 2) -> ${live.total === 2 ? '✅' : '❌'}`);

if (selection.length === 12) {
    console.log('\nOverall Result: SUCCESS! Total items = 12.');
} else {
    console.log(`\nOverall Result: FAILURE! Total items = ${selection.length} (Expected: 12).`);
}
