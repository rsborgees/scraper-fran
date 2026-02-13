function cleanName(fileName) {
    let clean = fileName.toLowerCase()
        .replace(/\.jpg|\.png|\.jpeg|\.webp/g, '')
        .replace(/favorito/g, '')
        .replace(/unavailable/g, '')
        .trim();

    // Remove 'live' only if it's at the end
    clean = clean.replace(/\s+live$/i, '').trim();

    // Normalize spaces
    clean = clean.replace(/\s+/g, ' ');
    return clean;
}

const tests = [
    { input: 'Macaquinho shorts fit Green live.jpg', expected: 'macaquinho shorts fit green' },
    { input: 'Live Top Nadador.png', expected: 'live top nadador' },
    { input: 'Shorts live da nike.jpg', expected: 'shorts live da nike' },
    { input: 'Conjunto live.webp', expected: 'conjunto' },
    { input: 'live.jpg', expected: 'live' }, // Edge case: just 'live' -> 'live' because \s+ requires space before.
    // If user wants "live.jpg" -> "", regex needs adjustment. 
    // "se o nome live estiver no final, pode tirar" implies "Macaquinho live" -> "Macaquinho".
    // "live" as the only word is "at the end"? Techncially yes.
    // My regex: `\s+live$`. Requires space.
    // "live" -> no space -> no match.
    // Let's test " live.jpg"
    { input: ' live.jpg', expected: '' }, // space + live -> empty
];

console.log('🚀 Testing Name Cleaning Logic...');
let errors = 0;
tests.forEach(t => {
    const res = cleanName(t.input);
    if (res !== t.expected) {
        console.error(`❌ Failed: "${t.input}" -> "${res}" (Expected: "${t.expected}")`);
        errors++;
    } else {
        console.log(`✅ Passed: "${t.input}" -> "${res}"`);
    }
});

if (errors === 0) console.log('🎉 All tests passed!');
else process.exit(1);
