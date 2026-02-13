const { buildLiveMessage } = require('./messageBuilder');

const mockProducts = [
    {
        nome: 'macaquinho bermuda bynature preto',
        precoOriginal: 299.90,
        precoAtual: 199.90,
        tamanhos: ['P', 'M', 'G'],
        url: 'https://www.liveoficial.com.br/macaquinho-bermuda-bynature-preto/p',
        loja: 'live'
    }
];

const mockSet = [
    {
        nome: 'Top + Legging Live',
        precoOriginal: 450.00,
        precoAtual: 350.00,
        tamanhos: ['M', 'G'],
        url: 'https://www.liveoficial.com.br/top/p',
        loja: 'live'
    }
];

console.log('--- TEST SINGLE PRODUCT ---');
console.log(buildLiveMessage(mockProducts));

console.log('\n--- TEST SET/MULTIPLE PRODUCTS ---');
console.log(buildLiveMessage(mockSet));

const mockZero = [
    {
        nome: 'Produto Erro',
        precoAtual: 0,
        tamanhos: [],
        url: 'https://www.liveoficial.com.br/erro',
        loja: 'live'
    }
];

console.log('\n--- TEST ZERO PRICE (should not have installments) ---');
console.log(buildLiveMessage(mockZero));
