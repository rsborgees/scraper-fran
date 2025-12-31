
// Simulação de textos que podem aparecer no site da Farm
const testCases = [
    "tic-tac: 25%OFF nos looks da coleção! cupom QUERO25",
    "tic-tac: 30% OFF nos looks da coleção! cupom QUERO30",
    "tic-tac: 15%OFF nos looks! USE: FESTA15",
    "Aproveite 50% OFF agora com CÓDIGO: RELAMPAGO",
    "Somente hoje: 10%OFF - cupom: BOASVINDAS"
];

console.log("--- TESTANDO VARIAÇÃO DE VALORES ---");

testCases.forEach((text, index) => {
    console.log(`\nCaso ${index + 1}: "${text}"`);

    // Regex usados no timer_check.js
    const cupomRegex = /(?:CUPOM|CÓDIGO|USE)[\s\n\r]*[:]?[\s\n\r]*([A-Z0-9]{4,})/i;
    const tictacMatch = text.match(/tic-tac.*?(\d{1,2}%\s*OFF)/i);
    const percentMatch = text.match(/(\d{1,2}%\s*OFF)/i);

    const code = text.match(cupomRegex)?.[1].toUpperCase() || "NÃO ENCONTRADO";
    const percent = (tictacMatch ? tictacMatch[1] : percentMatch?.[1])?.toUpperCase() || "NÃO ENCONTRADO";

    console.log(`   > Código detectado: ${code}`);
    console.log(`   > Porcentagem detectada: ${percent}`);
});
