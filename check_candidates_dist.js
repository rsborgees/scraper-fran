const { getExistingIdsFromDrive } = require('./driveManager');
const { loadHistory, normalizeId } = require('./historyManager');
require('dotenv').config();

async function checkCandidates() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    try {
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        const history = loadHistory();

        let candidates = allDriveItems.filter(item => (item.isFavorito || item.novidade) && !item.bazar);
        
        candidates.forEach(item => {
            const normId = normalizeId(item.driveId || item.id);
            const historyEntry = history[normId];
            item._lastSent = historyEntry ? historyEntry.timestamp : 0;
        });

        candidates.sort((a, b) => {
            if (a._lastSent !== b._lastSent) return a._lastSent - b._lastSent;
            if (a.isFavorito && !b.isFavorito) return -1;
            if (!a.isFavorito && b.isFavorito) return 1;
            return 0;
        });

        const targetItems = candidates.slice(0, 50);
        
        const storeStats = {};
        targetItems.forEach(item => {
            storeStats[item.store] = (storeStats[item.store] || 0) + 1;
        });

        console.log('📊 Distribuição dos Top 50 Candidatos:');
        Object.entries(storeStats).forEach(([store, count]) => {
            console.log(`- ${store.toUpperCase()}: ${count}`);
        });

        // Simular cota dinâmica
        // (Copied roughly from cronScheduler.js)
        const currentStats = {
            total: 58,
            stores: { farm: 43, dressto: 8, live: 0, kju: 5, zzmall: 2 }
        };
        
        // Let's see what calculateDynamicQuotas would give
        const GLOBAL_TARGET = 158;
        const IDEAL_TARGETS = {
            farm: Math.round(GLOBAL_TARGET * 0.70),
            dressto: Math.round(GLOBAL_TARGET * 0.15),
            live: Math.round(GLOBAL_TARGET * 0.08),
            kju: Math.round(GLOBAL_TARGET * 0.05),
            zzmall: Math.round(GLOBAL_TARGET * 0.02)
        };
        
        console.log('\n📊 Gaps:');
        Object.keys(IDEAL_TARGETS).forEach(store => {
            const current = currentStats.stores[store] || 0;
            const target = IDEAL_TARGETS[store];
            console.log(`- ${store}: ${current}/${target} (Gap: ${target - current})`);
        });

    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

checkCandidates();
