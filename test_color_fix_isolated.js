const { normalizeId } = require('./historyManager');

console.log('--- Testing normalizeId ---');
const testCases = [
    { id: '357793_51202', expected: '357793_51202' },
    { id: '357793-51202', expected: '357793_51202' },
    { id: '357793', expected: '357793' },
    { id: '00357793', expected: '357793' },
    { id: '357793 51202', expected: '35779351202' }
];

testCases.forEach(tc => {
    const result = normalizeId(tc.id);
    console.log(`Input: ${tc.id} -> Output: ${result} | ${result === tc.expected ? '✅' : '❌'}`);
});

console.log('\n--- Testing Regex in index.js ---');
const url = 'https://www.farmrio.com.br/vestido-longo-357793-51202/p';
const idMatch = url.match(/(\d{6,}[_-]\d+|\d{6,})/);
if (idMatch) {
    const earlyId = idMatch[1];
    const norm = normalizeId(earlyId);
    console.log(`URL: ${url}`);
    console.log(`Captured: ${earlyId} -> Normalized: ${norm} | ${norm === '357793_51202' ? '✅' : '❌'}`);
} else {
    console.log('❌ No match');
}

console.log('\n--- Testing Logic in parser.js (Mock) ---');
const rawIds = ['REF: 357793_51202', '357793-51202', '35779351202'];
rawIds.forEach(rawId => {
    let id = 'unknown';
    // Logic from parser.js
    const compositeMatch = rawId.match(/(\d{6,}[_-]\d+)/);
    if (compositeMatch) {
        id = compositeMatch[1].replace(/-/g, '_');
    } else {
        const numericId = rawId.replace(/\D/g, '');
        if (numericId.length >= 6) id = numericId; // The new line
        else if (numericId.length > 0) id = numericId;
    }
    console.log(`Raw: ${rawId} -> Extracted ID: ${id}`);
});
