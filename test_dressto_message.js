const { buildDressMessage } = require('./messageBuilder');

// Test Case 1: All fields present
const p1 = {
    nome: "VESTIDO MIDI FLORAL",
    tamanhos: ["P", "M", "G"],
    precoAtual: 299.90,
    precoOriginal: 399.90,
    url: "https://www.dressto.com.br/vestido-midi-floral/p"
};

console.log("--- TEST 1: ALL FIELDS ---");
console.log(buildDressMessage(p1));
console.log("\n");

// Test Case 2: Using fallbacks (preco instead of precoAtual, link instead of url)
const p2 = {
    nome: "MACACÃO JEANS",
    tamanhos: ["38", "40"],
    preco: 199.00,
    link: "https://www.dressto.com.br/macacao-jeans/p"
};

console.log("--- TEST 2: FALLBACK FIELDS ---");
console.log(buildDressMessage(p2));
console.log("\n");

// Test Case 3: Missing fields
const p3 = {
    nome: "BLUSA SEDA",
};

console.log("--- TEST 3: MISSING FIELDS ---");
console.log(buildDressMessage(p3));
