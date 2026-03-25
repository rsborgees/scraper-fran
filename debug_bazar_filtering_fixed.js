const { normalizeId } = require('./historyManager');

// Mock data similar to what's in orchestrator.js
const allDriveItems = [
    { id: '123456', name: 'prod1 bazar.jpg', bazar: true, store: 'farm' },
    { id: '234567', name: 'prod2.jpg', bazar: false, store: 'farm' },
    { id: '345678', name: 'prod3 bazar favorito.jpg', bazar: true, isFavorito: true, store: 'farm' },
    { id: '456789', name: 'prod4 favorito.jpg', bazar: false, isFavorito: true, store: 'farm' }
];

function isDuplicateMock(id, options = {}) {
    // Simulate some items being recently sent (within 48h)
    const recentlySent = ['123456']; 
    const normId = normalizeId(id);
    
    if (recentlySent.includes(normId)) {
        // Line 148 logic in orchestrator: const maxAge = item.bazar ? 0 : 48;
        // isDuplicate(id, { force: !!item.bazar, maxAgeHours: maxAge })
        
        if (options.maxAgeHours === 0 && options.force) {
            console.log(`      [Mock] Item ${normId} is recently sent but allowed (maxAge: 0, force: true)`);
            return false;
        }
        return true;
    }
    return false;
}

console.log('--- Testing FIXED Orchestrator Filtering Logic ---');

const farmDriveItems = allDriveItems.filter(item => {
    // NEW Logic in orchestrator.js (relaxed for Bazar)
    if ((item.isFavorito || item.novidade || item.favorito || item.isNovidade) && !item.bazar) {
        console.log(`Item ${item.id} excluded because it is Favorito/Novidade and NOT Bazar`);
        return false;
    }

    // NEW Logic in orchestrator.js (relaxed duplicate for Bazar)
    const maxAge = item.bazar ? 0 : 48;
    const isDup = isDuplicateMock(normalizeId(item.id), { force: !!item.bazar, maxAgeHours: maxAge });
    if (isDup) {
        console.log(`Item ${item.id} excluded because it is a Duplicate (${maxAge}h)`);
        return false;
    }

    return true;
});

console.log('\nFinal farmDriveItems counts:');
console.log('Total:', farmDriveItems.length);
const bazars = farmDriveItems.filter(i => i.bazar);
console.log('Bazars in pool:', bazars.length);

if (bazars.length === 2) {
    console.log('✅ SUCCESS: Both bazar items (including recently sent and favorite) are in the pool!');
} else {
    console.log('❌ FAILURE: Bazar items are still being filtered out.');
}
