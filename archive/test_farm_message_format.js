const { buildFarmMessage } = require('./messageBuilder');

const mockSet = {
    nome: 'Vestido Estampado + Casaco Tricot',
    id: '123_456',
    precoAtual: 250.00,
    precoOriginal: 330.00,
    isSet: true,
    loja: 'farm',
    items: [
        {
            nome: 'Blusa',
            tamanhos: ['P', 'PP', 'M', 'G', 'GG'],
            precoAtual: 130.00,
            url: 'https://www.farmrio.com.br/blusa-123',
            id: '123'
        },
        {
            nome: 'Short',
            tamanhos: ['P', 'M', 'G'],
            precoOriginal: 200.00,
            precoAtual: 120.00,
            url: 'https://www.farmrio.com.br/short-456',
            id: '456'
        }
    ]
};

const timerData = {
    progressive: false,
    ativo: true,
    discountCode: '7B1313', // Simulado
    discountPercent: '10%'
};

console.log('--- TESTE CONJUNTO FARM ---');
const setMsg = buildFarmMessage(mockSet, timerData);
console.log(setMsg);

console.log('\n--- TESTE SINGLE FARM ---');
const singleProduct = {
    nome: 'Vestido Floral',
    tamanhos: ['P', 'M'],
    precoAtual: 190.00,
    precoOriginal: 190.00,
    url: 'https://www.farmrio.com.br/vestido-floral',
    loja: 'farm'
};
const singleMsg = buildFarmMessage(singleProduct, timerData);
console.log(singleMsg);
