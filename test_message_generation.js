const {
    buildFarmMessage,
    buildDressMessage,
    buildKjuMessage,
    buildLiveMessage,
    buildZzMallMessage
} = require('./messageBuilder');

// Mock Products
const pFarm = {
    nome: 'Vestido Flor de Cogumelo',
    precoAtual: 287.00,
    precoOriginal: 359.00,
    tamanhos: ['PP', 'P', 'M', 'G'],
    url: 'https://www.farmrio.com.br/vestido',
    id: '123'
};
const pKju = {
    nome: 'Garrafa Bahia',
    precoAtual: 124.00,
    precoOriginal: 198.00,
    url: 'https://www.kju.com/garrafa',
    id: '456'
};
const pLive1 = {
    nome: 'Top Icon Neo',
    precoAtual: 179.90,
    precoOriginal: 259.00,
    tamanhos: ['M'],
    url: 'https://live.com/top',
    id: '789'
};
const pLive2 = {
    nome: 'Short Air Dot',
    precoAtual: 359.00,
    url: 'https://live.com/short',
    id: '790'
};
const pDress = {
    nome: 'Vestido Tule',
    precoAtual: 449.00,
    tamanhos: ['P', 'M'],
    url: 'https://dressto.com.br/vestido',
    id: '101'
};
const pZz = {
    nome: 'Sandália Vinho',
    precoAtual: 151.00,
    precoOriginal: 379.00,
    url: 'https://zzmall.com.br/sandalia',
    id: '202'
};

console.log('--- TESTE DE FORMATAÇÃO ---\n');

console.log('>>> FARM (Timer Ativo)');
console.log(buildFarmMessage(pFarm, { ativo: true, cupom: '25% OFF' }));
console.log('\n>>> FARM (Timer Inativo)');
console.log(buildFarmMessage(pFarm, null));

const pFarmFullRatio = {
    nome: 'Macacão Liso',
    precoAtual: 500.00,
    tamanhos: ['P', 'M'],
    url: 'https://www.farmrio.com.br/macacao',
    id: '999'
};
console.log('\n>>> FARM (Full Price - Deve ter 10% message)');
console.log(buildFarmMessage(pFarmFullRatio, null));

console.log('\n>>> KJU');
console.log(buildKjuMessage(pKju));

console.log('\n>>> DRESS TO');
console.log(buildDressMessage(pDress));

console.log('\n>>> LIVE (Conjunto)');
console.log(buildLiveMessage([pLive1, pLive2]));

console.log('\n>>> ZZMALL');
console.log(buildZzMallMessage(pZz));
