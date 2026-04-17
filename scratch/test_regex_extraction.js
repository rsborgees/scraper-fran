function extractSize(filename) {
    const sizeMatch = filename.match(/\b(PP|P|M|G|GG|G1|G2|G3)\b/i);
    return sizeMatch ? sizeMatch[1].toUpperCase() : null;
}

const testCases = [
    "123456 P farm",
    "355028 M dressto",
    "G kju 999111",
    "vestido longo GG farm",
    "PP novidade 123456",
    "355028 P M farm", // Multiple sizes - should pick first
    "355028 farm",   // No size
    "355028fav P farm", // Mixed
    "355028 G2 farm",
    "355028 Farm P"
];

testCases.forEach(tc => {
    console.log(`Filename: "${tc}" -> Extracted Size: ${extractSize(tc)}`);
});
