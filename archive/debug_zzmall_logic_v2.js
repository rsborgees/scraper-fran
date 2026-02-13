
const clothingTerms = ['vestido', 'blusa', 'casaco', 'saia', 'short', 'macacão', 'top', 'biquíni', 'body', 'camisa', 'jaqueta', 'blazer', 'pantalo', 'regata', 't-shirt', 'tricot'];

function isClothCheck(nome, categoria) {
    const normalizedCat = categoria ? categoria.toLowerCase() : '';
    const productNomeLower = nome.toLowerCase();

    // Specific check for "calça" vs "calçado"
    const hasCalca = /\bcalça\b/.test(normalizedCat) || /\bcalça\b/.test(productNomeLower);

    const matchedTerm = clothingTerms.find(c => normalizedCat.includes(c) || productNomeLower.includes(c));
    const isCloth = !!matchedTerm || hasCalca;

    return { isCloth, matchedTerm, hasCalca };
}

const testCases = [
    { nome: "BOLSA TOTE MÉDIA METALASSÊ BRANCA", categoria: "calçado" },
    { nome: "BOLSA TOTE MÉDIA METALASSÊ MARROM", categoria: "calçado" },
    { nome: "SANDÁLIA RASTEIRA CINZA CROCO", categoria: "calçado" },
    { nome: "CAMISETA VANS CLASSIC SS LONDON FOG", categoria: "calçado" }
];

testCases.forEach(tc => {
    const result = isClothCheck(tc.nome, tc.categoria);
    console.log(`Product: ${tc.nome} | Cat: ${tc.categoria} => isCloth: ${result.isCloth} (Matched: ${result.matchedTerm || 'none'}, hasCalca: ${result.hasCalca})`);
});
