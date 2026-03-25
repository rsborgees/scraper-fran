const { normalizeId } = require('./historyManager');

// Mock data similar to what's in orchestrator.js
const driveItems = [
    { id: '123456', name: 'prod1 bazar.jpg', bazar: true, store: 'farm' },
    { id: '234567', name: 'prod2.jpg', bazar: false, store: 'farm' },
    { id: '345678', name: 'prod3 bazar favorito.jpg', bazar: true, isFavorito: true, store: 'farm' }
];

function isDuplicateMock(id, options = {}) {
    // 48h rule
    const recentlySent = ['999999']; // None of our test items
    if (recentlySent.includes(normalizeId(id))) return true;
    return false;
}

console.log('--- Testing Orchestrator Logic (48h Strict) ---');

// Phase 1 filter logic
const farmDriveItems = driveItems.filter(item => {
    // 1. Favorito/Novidade check (This is what I suspect was blocking bazar favorites)
    if ((item.isFavorito || item.novidade || item.favorito || item.isNovidade) && !item.bazar) {
         return false;
    }
    
    // 2. Duplicate check
    const maxAge = 48;
    return !isDuplicateMock(normalizeId(item.id), { maxAgeHours: maxAge });
});

console.log('Pool size:', farmDriveItems.length);
const bazars = farmDriveItems.filter(i => i.bazar);
console.log('Bazars in pool:', bazars.length);

if (bazars.length > 0) {
    console.log('✅ Bazar items ARE in the pool.');
} else {
    console.log('❌ Bazar items are NOT in the pool.');
}
