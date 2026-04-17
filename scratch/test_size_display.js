const { buildFarmMessage, buildDressMessage, buildKjuMessage, buildZzMallMessage } = require('../messageBuilder');

const mockProduct = {
    nome: "Vestido Teste",
    id: "123456",
    precoAtual: 100,
    precoOriginal: 120,
    tamanhos: ["P", "M", "G"],
    url: "https://www.farmrio.com.br/vestido-teste/p",
    loja: "farm",
    driveSize: "M" // Simulating extracted size
};

console.log("--- FARM MESSAGE ---");
console.log(buildFarmMessage(mockProduct));
console.log("\n");

const mockDress = {
    nome: "Vestido Dress",
    id: "789012",
    precoAtual: 200,
    precoOriginal: 250,
    tamanhos: ["PP", "P", "M"],
    url: "https://www.dressto.com.br/vestido-dress/p",
    loja: "dressto",
    driveSize: "P"
};

console.log("--- DRESS TO MESSAGE ---");
console.log(buildDressMessage(mockDress));
console.log("\n");

const mockKju = {
    nome: "Blusa KJU",
    id: "345678",
    precoAtual: 150,
    precoOriginal: 150,
    url: "https://www.kjubrasil.com/blusa-kju/p",
    loja: "kju",
    driveSize: "G"
};

console.log("--- KJU MESSAGE ---");
console.log(buildKjuMessage(mockKju));
console.log("\n");

const mockZz = {
    nome: "Sandália ZZ",
    id: "901234",
    precoAtual: 300,
    precoOriginal: 350,
    url: "https://www.zzmall.com.br/sandalia-zz/p",
    loja: "zzmall",
    driveSize: "37" // Test with a number (though regex currently targets P/M/G/etc.)
};

// Update: regex currently matches \b(PP|P|M|G|GG|G1|G2|G3)\b
// Let's test with GG
mockZz.driveSize = "GG";

console.log("--- ZZ MALL MESSAGE ---");
console.log(buildZzMallMessage(mockZz));
console.log("\n");

// Test Set Product
const mockSet = {
    nome: "Conjunto Teste",
    id: "111222_333444",
    isSet: true,
    driveSize: "P",
    items: [
        { nome: "Top", tamanhos: ["P", "M"], precoAtual: 50, url: "https://www.farmrio.com.br/top/p" },
        { nome: "Saia", tamanhos: ["P", "G"], precoAtual: 80, url: "https://www.farmrio.com.br/saia/p" }
    ]
};

console.log("--- FARM SET MESSAGE ---");
console.log(buildFarmMessage(mockSet));
