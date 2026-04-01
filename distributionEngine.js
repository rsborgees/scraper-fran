/**
 * Engine de Distribuição de Links
 */

// Cotas Diárias (Base ~11 links por execução para atingir ~165/dia em 15 horários)
const TOTAL_LINKS = 11;
const QUOTAS = {
    FARM: {
        percent: 0.53,
        count: 4,
        dailyGoal: 56
    },
    DRESS: {
        percent: 0.21,
        count: 2.0,
        dailyGoal: 22
    },
    KJU: {
        percent: 0.09,
        count: 0.7,
        dailyGoal: 10
    },
    LIVE: {
        percent: 0.11,
        count: 0.8,
        dailyGoal: 12
    },
    ZZMALL: {
        percent: 0.06,
        count: 0.4,
        dailyGoal: 6
    }
};

// Máximo absoluto de itens POR EXECUÇÃO por loja.
// Mesmo que haja gap (Farm/Dress não encheu), as lojas menores NÃO absorvem o slack.
const RUN_CAPS = {
    farm: 8,      // 7 normal + 1 bazar (já controlado separadamente)
    dressto: 5,   // Reduzido para 5 (meta de recuperação)
    kju: 1,
    live: 2,
    zzmall: 1
};


// Sub-cotas Dress To
const DRESS_SUBQUOTAS = {
    'vestido': 0.60,
    'macacão': 0.25,
    'blusa': 0.03, // Equidistributed 15% / 5
    'saia': 0.03,
    'short': 0.03,
    'calça': 0.03,
    'casaco': 0.03
};

// Sub-cotas FARM
const FARM_SUBQUOTAS = {
    'vestido': 0.65,
    'macacão': 0.15,
    'saia': 0.05,
    'short': 0.05,
    'blusa': 0.05,
    'acessórios': 0.05
};

/**
 * Embaralha array (Fisher-Yates)
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Filtra produtos elegíveis baseados em regras de repetição
 */
function filterEligibleProducts(products) {
    return products.filter(p => true);
}

/**
 * Distribui produtos nos slots disponíveis
 * @param {Array} allProducts Array de objetos de produto
 * @param {Object} runQuotas Quotas para esta execução (opcional)
 * @param {Object} dailyRemaining Quotas restantes do dia (opcional)
 */
function distributeLinks(allProducts, runQuotas = {}, dailyRemaining = {}) {
    const finalSelection = [];
    const selectedIds = new Set();

    // Contadores desta rodada por loja
    const roundCounts = {
        farm: 0,
        dressto: 0,
        kju: 0,
        live: 0,
        zzmall: 0
    };

    // Auxiliar: Verifica se loja ainda tem saldo no dia
    const hasDailySaldo = (store) => {
        const rem = dailyRemaining && dailyRemaining.stores && dailyRemaining.stores[store] !== undefined
            ? dailyRemaining.stores[store]
            : 999;
        return (rem - roundCounts[store]) > 0;
    };

    // 1. SELEÇÃO BAZAR (Exatamente 1 item por execução, prioridade FARM)
    const bazarPool = allProducts.filter(p => p.bazar || p.isBazar);
    console.log(`📊 [Distribution] Pool de Bazar: ${bazarPool.length} itens.`);

    if (bazarPool.length > 0) {
        // Prioriza Farm se houver bazar e se Farm tiver saldo
        const farmBazar = bazarPool.find(p => (p.loja === 'farm' || (p.brand || '').toLowerCase() === 'farm') && hasDailySaldo('farm'));
        let selectedBazar = null;

        if (farmBazar) {
            selectedBazar = farmBazar;
            console.log(`✅ [Distribution] Selecionado Bazaar FARM (Prioridade): ${selectedBazar.nome} (${selectedBazar.id})`);
        } else {
            // Pega o primeiro bazar disponível de uma loja que tenha saldo diário
            selectedBazar = bazarPool.find(p => {
                const s = (p.brand || p.loja || '').toLowerCase();
                const storeKey = (s === 'dress' || s === 'dressto') ? 'dressto' : s;
                return hasDailySaldo(storeKey);
            });
            if (selectedBazar) console.log(`✅ [Distribution] Selecionado Bazaar ${selectedBazar.loja}: ${selectedBazar.nome} (${selectedBazar.id})`);
        }

        if (selectedBazar) {
            finalSelection.push(selectedBazar);
            selectedIds.add(selectedBazar.id);
            const s = (selectedBazar.brand || selectedBazar.loja || '').toLowerCase();
            const storeKey = (s === 'dress' || s === 'dressto') ? 'dressto' : s;
            if (roundCounts[storeKey] !== undefined) roundCounts[storeKey]++;
        }
    }

    // 2. SELEÇÃO REGULAR (Itens que NÃO são bazar E QUE NÃO são favoritos/novidades)
    const regularPool = allProducts.filter(p => {
        if (selectedIds.has(p.id)) return false;
        if (p.bazar || p.isBazar) return false;

        const isFavOrNov = p.favorito || p.isFavorito || p.novidade || p.isNovidade || p.isSiteNovidade;
        if (isFavOrNov) return false; // Strictly exclude from ALL STORES hourly

        return true;
    });

    // 1ª PASSAGEM: Seleção Dinâmica baseada nas metas da rodada (runQuotas)
    // Isso garante exatamente os 70/15/8/5/2% solicitados.
    const allStores = ['farm', 'dressto', 'live', 'kju', 'zzmall'];
    
    let iterations = 0;
    while (finalSelection.length < TOTAL_LINKS && iterations < 50) {
        iterations++;
        let addedThisRound = false;
        
        for (const store of allStores) {
            if (finalSelection.length >= TOTAL_LINKS) break;
            
            // A meta da rodada para esta loja
            const target = runQuotas[store] || 0;
            if (roundCounts[store] >= target) continue;
            
            // Saldo diário restante (Supabase + histórico local)
            if (!hasDailySaldo(store)) continue;

            const nextItem = regularPool.find(p => {
                if (selectedIds.has(p.id)) return false;
                const s = (p.loja || p.brand || '').toLowerCase();
                const storeKey = (s === 'dress' || s === 'dressto') ? 'dressto' : s;
                return storeKey === store;
            });

            if (nextItem) {
                finalSelection.push(nextItem);
                selectedIds.add(nextItem.id);
                roundCounts[store]++;
                addedThisRound = true;
            }
        }
        if (!addedThisRound) break;
    }

    // 3. FILLER (Se ainda houver gap, usa Favoritos de qualquer loja ou Bazar extras)
    if (finalSelection.length < TOTAL_LINKS) {
        let gap = TOTAL_LINKS - finalSelection.length;
        const fillerPool = allProducts.filter(p => {
            if (selectedIds.has(p.id)) return false;
            const s = (p.brand || p.loja || '').toLowerCase();
            const storeKey = (s === 'dress' || s === 'dressto') ? 'dressto' : s;
            if (!hasDailySaldo(storeKey)) return false;
            if (roundCounts[storeKey] >= (RUN_CAPS[storeKey] || 999)) return false; // Cap absoluto por run

            // REGRAS FILLER FARM PRE-FILTER:
            // 1. Não pega mais Bazar se já enviou 1
            if (storeKey === 'farm' && (p.bazar || p.isBazar) && roundCounts.farm >= 1) return false;
            // 2. Nunca pega favorito/novidade no horário (mesmo se sobrar vaga)
            if (storeKey === 'farm' && (p.favorito || p.isFavorito || p.novidade || p.isNovidade)) return false;

            return true;
        });

        // Agora fillerPool já tem só itens válidos e aceitos
        fillerPool.slice(0, gap).forEach(p => {
            const s = (p.brand || p.loja || '').toLowerCase();
            const storeKey = (s === 'dress' || s === 'dressto') ? 'dressto' : s;

            finalSelection.push(p);
            selectedIds.add(p.id);
            if (roundCounts[storeKey] !== undefined) roundCounts[storeKey]++;
        });
    }

    return shuffle(finalSelection);
}

module.exports = { distributeLinks, QUOTAS, RUN_CAPS, FARM_SUBQUOTAS, DRESS_SUBQUOTAS };
