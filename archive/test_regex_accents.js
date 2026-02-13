
const terms = ['macacão', 'moletom', 'calça', 'biquíni'];
const testStr = "Lindo macacão de seda";

terms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    console.log(`Testing "${term}" in "${testStr}":`, regex.test(testStr));
});

// Let's try matching "calça" in "Calçado"
const testStr2 = "Sapatos e calçados";
const regexCalca = /\bcalça\b/i;
console.log(`Testing "calça" in "${testStr2}":`, regexCalca.test(testStr2));
