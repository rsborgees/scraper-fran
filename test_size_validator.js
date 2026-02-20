const { hasStandardSizes, isValidClothingSize } = require('./sizeValidator');

const tests = [
    { sizes: ['PP'], expected: false, desc: 'Apenas PP deve ser inválido' },
    { sizes: ['GG'], expected: false, desc: 'Apenas GG deve ser inválido' },
    { sizes: ['PP', 'GG'], expected: true, desc: 'PP e GG juntos deve ser válido' },
    { sizes: ['P'], expected: true, desc: 'P deve ser válido' },
    { sizes: ['M'], expected: true, desc: 'M deve ser válido' },
    { sizes: ['G'], expected: true, desc: 'G deve ser válido' },
    { sizes: ['PP', 'P'], expected: true, desc: 'PP e P juntos deve ser válido' },
    { sizes: ['GG', 'G'], expected: true, desc: 'GG e G juntos deve ser válido' },
    { sizes: ['38'], expected: true, desc: '38 deve ser válido' },
    { sizes: ['PP', '38'], expected: true, desc: 'PP e 38 juntos deve ser válido' },
    { sizes: ['UN'], expected: true, desc: 'UN deve ser válido (regra flexível para acessórios/geral)' },
];

console.log('🧪 Iniciando Testes de Validação de Tamanho...\n');

let passed = 0;
let failed = 0;

tests.forEach(test => {
    const result = hasStandardSizes(test.sizes);
    if (result === test.expected) {
        console.log(`✅ [PASS] ${test.desc}`);
        passed++;
    } else {
        console.error(`❌ [FAIL] ${test.desc} | Esperado: ${test.expected}, Recebido: ${result}`);
        failed++;
    }
});

// Teste de Categoria
console.log('\n🧪 Testando Filtro por Categoria...');
const categoryTest = isValidClothingSize(['PP'], 'calçado');
if (categoryTest === true) {
    console.log('✅ [PASS] Calçado com apenas PP deve ser aceito (não é categoria de roupa restrita)');
    passed++;
} else {
    console.error('❌ [FAIL] Calçado com apenas PP foi rejeitado');
    failed++;
}

const clothingTest = isValidClothingSize(['PP'], 'vestido');
if (clothingTest === false) {
    console.log('✅ [PASS] Vestido com apenas PP deve ser rejeitado');
    passed++;
} else {
    console.error('❌ [FAIL] Vestido com apenas PP foi aceito');
    failed++;
}

console.log(`\n📊 Resultado: ${passed} passados, ${failed} falhos.`);

if (failed > 0) {
    process.exit(1);
}
