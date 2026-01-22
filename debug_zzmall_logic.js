
const normalizedCat = "calçado";
const productNomeLower = "bolsa tote média metalassê branca";

const clothingTerms = ['vestido', 'blusa', 'casaco', 'saia', 'short', 'macacão', 'top', 'biquíni', 'body', 'camisa', 'jaqueta', 'blazer', 'pantalo', 'regata', 't-shirt', 'tricot'];

const hasCalca = /\bcalça\b/.test(normalizedCat) || /\bcalça\b/.test(productNomeLower);
const isCloth = clothingTerms.some(c => normalizedCat.includes(c) || productNomeLower.includes(c)) || hasCalca;

console.log("normalizedCat:", normalizedCat);
console.log("productNomeLower:", productNomeLower);
console.log("hasCalca:", hasCalca);
console.log("isCloth:", isCloth);

clothingTerms.forEach(term => {
    if (normalizedCat.includes(term) || productNomeLower.includes(term)) {
        console.log(`Matched term: ${term}`);
    }
});
