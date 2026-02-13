/**
 * Test script to verify the priority scoring and sorting logic.
 */

// Mock items
const items = [
    { name: 'Old Regular', isFavorito: false, novidade: false, createdTime: '2025-01-01T00:00:00Z' },
    { name: 'New Regular', isFavorito: false, novidade: false, createdTime: new Date().toISOString() },
    { name: 'Old Favorite', isFavorito: true, novidade: false, createdTime: '2025-01-01T00:00:00Z' },
    { name: 'New Favorite', isFavorito: true, novidade: false, createdTime: new Date().toISOString() },
    { name: 'Old Novidade', isFavorito: false, novidade: true, createdTime: '2025-01-01T00:00:00Z' },
    { name: 'New Novidade', isFavorito: false, novidade: true, createdTime: new Date().toISOString() },
];

function getPriorityScore(item) {
    let score = 0;
    if (item.novidade) score += 1000;
    if (item.isFavorito) score += 500;

    if (item.createdTime) {
        const createdDate = new Date(item.createdTime);
        const now = new Date();
        const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 7) score += 100;
    }

    return score;
}

const sorted = items.map(item => ({
    ...item,
    score: getPriorityScore(item)
})).sort((a, b) => b.score - a.score);

console.log('--- SORTED ITEMS ---');
sorted.forEach(item => {
    console.log(`[Score: ${item.score.toString().padStart(4, ' ')}] ${item.name}`);
});

// Verification assertions
const expectedOrder = [
    'New Novidade', // 1000 + 100 = 1100
    'Old Novidade', // 1000
    'New Favorite', // 500 + 100 = 600
    'Old Favorite', // 500
    'New Regular',  // 100
    'Old Regular'   // 0
];

let success = true;
sorted.forEach((item, index) => {
    if (item.name !== expectedOrder[index]) {
        console.error(`❌ Mismatch at index ${index}: Expected ${expectedOrder[index]}, got ${item.name}`);
        success = false;
    }
});

if (success) {
    console.log('\n✅ Priority logic verified successfully!');
} else {
    process.exit(1);
}
