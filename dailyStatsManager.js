const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, 'data', 'daily_stats.json');

const INITIAL_STATS = {
    date: null,
    total: 0,
    stores: {
        farm: 0,
        dressto: 0,
        kju: 0,
        live: 0,
        zzmall: 0
    },
    farmCategories: {
        vestido: 0,
        macacão: 0,
        outros: 0
    },
    bazarCount: 0
};

function loadStats() {
    try {
        if (!fs.existsSync(STATS_FILE)) {
            return resetStats();
        }
        const data = fs.readFileSync(STATS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao carregar daily_stats:', e.message);
        return resetStats();
    }
}

function saveStats(stats) {
    try {
        const dir = path.dirname(STATS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error('Erro ao salvar daily_stats:', e.message);
    }
}

function resetStats() {
    const today = new Date().toISOString().split('T')[0];
    const stats = { ...INITIAL_STATS, date: today };
    saveStats(stats);
    return stats;
}

function resetIfNewDay() {
    const stats = loadStats();
    const today = new Date().toISOString().split('T')[0];

    // Se mudou o dia
    if (stats.date !== today) {
        console.log(`🌞 Novo dia detectado (${today}). Resetando estatísticas diárias.`);
        return resetStats();
    }
    return stats;
}

/**
 * Registra itens enviados e atualiza contadores
 */
function recordSentItems(products) {
    const stats = resetIfNewDay();

    products.forEach(p => {
        const store = (p.loja || p.brand || 'unknown').toLowerCase();
        const category = (p.categoria || 'outros').toLowerCase();

        stats.total++;
        if (stats.stores[store] !== undefined) {
            stats.stores[store]++;
        }

        if (store === 'farm') {
            if (category === 'vestido' || category === 'macacão') {
                stats.farmCategories[category]++;
            } else {
                stats.farmCategories.outros++;
            }
        }

        if (p.bazar) {
            stats.bazarCount++;
        }
    });

    saveStats(stats);
    console.log(`📊 Stats atualizadas: Total Hoje ${stats.total}/165`);
}

// Metas Diárias
let DAILY_GOALS = {
    total: 165,
    stores: {
        farm: 115,
        dressto: 22,
        kju: 14,   // máx 1 por run
        live: 12,
        zzmall: 3  // máx 3 por dia
    },
    farmCategories: {
        vestido: 70, // ~60% of 115
        macacão: 29, // ~25% of 115
        outros: 16   // ~15% of 115
    }
};

/**
 * Permite atualizar as metas dinamicamente (ex: 15% da base da Dress To)
 */
function setDynamicGoals(newGoals) {
    if (newGoals.stores) {
        DAILY_GOALS.stores = { ...DAILY_GOALS.stores, ...newGoals.stores };
    }
    if (newGoals.total) {
        DAILY_GOALS.total = newGoals.total;
    }
    console.log(`🎯 [StatsManager] Metas atualizadas: DRESS=${DAILY_GOALS.stores.dressto}, FARM=${DAILY_GOALS.stores.farm}`);
}

/**
 * Retorna as quotas restantes para o dia
 */
function getRemainingQuotas() {
    const stats = resetIfNewDay();

    return {
        total: Math.max(0, DAILY_GOALS.total - stats.total),
        stores: {
            farm: Math.max(0, DAILY_GOALS.stores.farm - stats.stores.farm),
            dressto: Math.max(0, DAILY_GOALS.stores.dressto - stats.stores.dressto),
            live: Math.max(0, DAILY_GOALS.stores.live - stats.stores.live),
            kju: Math.max(0, DAILY_GOALS.stores.kju - stats.stores.kju),
            zzmall: Math.max(0, DAILY_GOALS.stores.zzmall - stats.stores.zzmall)
        },
        farmCategories: {
            vestido: Math.max(0, DAILY_GOALS.farmCategories.vestido - stats.farmCategories.vestido),
            macacão: Math.max(0, DAILY_GOALS.farmCategories.macacão - stats.farmCategories.macacão),
            outros: Math.max(0, DAILY_GOALS.farmCategories.outros - stats.farmCategories.outros)
        }
    };
}

module.exports = {
    loadStats,
    saveStats,
    resetIfNewDay,
    recordSentItems,
    getRemainingQuotas,
    setDynamicGoals
};
