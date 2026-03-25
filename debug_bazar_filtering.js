const { normalizeId } = require('./historyManager');

// Mock data similar to what's in orchestrator.js
const allDriveItems = [
    { id: '123456', name: 'prod1 bazar.jpg', bazar: true, store: 'farm' },
    { id: '234567', name: 'prod2.jpg', bazar: false, store: 'farm' },
    { id: '345678', name: 'prod3 bazar favorito.jpg', bazar: true, isFavorito: true, store: 'farm' }
];

function isDuplicateMock(id, options = {}) {
    // Simulate some items being recently sent (within 48h)
    const recentlySent = ['123456']; 
    if (recentlySent.includes(normalizeId(id))) return true;
    return false;
}

console.log('--- Testing Orchestrator Filtering Logic ---');

const farmDriveItems = allDriveItems.filter(item => {
    // Line 145 in orchestrator.js
    if (item.isFavorito || item.novidade || item.favorito || item.isNovidade) {
        console.log(`Item ${item.id} excluded because it is Favorito/Novidade`);
        return false;
    }

    // Line 148 in orchestrator.js
    const isDup = isDuplicateMock(normalizeId(item.id), { force: false, maxAgeHours: 48 });
    if (isDup) {
        console.log(`Item ${item.id} excluded because it is a Duplicate (48h)`);
        return false;
    }

    return true;
});

console.log('\nFinal farmDriveItems:', JSON.allDriveItems);
console.log('Count:', farmDriveItems.length);

const bazars = farmDriveItems.filter(i => i.bazar);
console.log('Bazars in pool:', bazars.length);
if (bazars.length === 0) {
    console.log('CRITICAL: No bazar items in pool for hourly scraper!');
}
