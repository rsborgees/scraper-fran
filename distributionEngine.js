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
    // 1. FILTRO: Remove Favoritos e Novidades (Não devem ir no horário, A MENOS QUE SEJAM BAZAR)
    const eligible = allProducts.filter(p => {
        const isFavOrNov = p.favorito || p.isFavorito || p.novidade || p.isNovidade;
        const isBazar = p.bazar || p.isBazar;
        return isBazar || !isFavOrNov;
    });

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

    // 2. SELEÇÃO BAZAR (Exatamente 1 item por execução, prioridade FARM)
    const bazarPool = eligible.filter(p => p.bazar || p.isBazar);
    console.log(`📊 [Distribution] Pool de Bazar: ${bazarPool.length} itens. (${bazarPool.map(p => p.id).join(', ')})`);
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
                const storeKey = s === 'dress' || s === 'dressto' ? 'dressto' : s;
                return hasDailySaldo(storeKey);
            });
            if (selectedBazar) console.log(`✅ [Distribution] Selecionado Bazaar Outra Loja: ${selectedBazar.nome} (${selectedBazar.id})`);
        }

        if (selectedBazar) {
            finalSelection.push(selectedBazar);
            selectedIds.add(selectedBazar.id);
            const s = (selectedBazar.brand || selectedBazar.loja || '').toLowerCase();
            const storeKey = s === 'dress' || s === 'dressto' ? 'dressto' : s;
            if (roundCounts[storeKey] !== undefined) roundCounts[storeKey]++;
        } else {
            console.log(`⚠️ [Distribution] Nenhum item do Bazar pool foi selecionado (saldo diário esgotado para todas as lojas com bazar?).`);
        }
    }

    // 3. SELEÇÃO REGULAR (Até atingir TOTAL_LINKS = 7)
    // Regra: 7 Farm, 2 Dress To, 1 Kju, 1 Live
    const regularPool = eligible.filter(p => !p.bazar);

    // PRIORIDADES E QUOTAS
    const mainStores = ['farm', 'dressto', 'kju', 'live'];
    const secondaryStores = ['zzmall'];
    const storeTargets = {
        farm: 7,
        dressto: 2,
        kju: 1,
        live: 1
    };

    // 1ª PASSAGEM: Prioridade Total para 4-2-1
    let iterations = 0;
    while (finalSelection.length < TOTAL_LINKS && iterations < 4) {
        iterations++;
        let addedThisRound = false;
        for (const store of mainStores) {
            if (finalSelection.length >= TOTAL_LINKS) break;
            const target = storeTargets[store] || 0;
            if (roundCounts[store] >= target) continue;

            const nextItem = regularPool.find(p => {
                if (selectedIds.has(p.id)) return false;
                const s = (p.loja || p.brand || '').toLowerCase();
                return s === store || (store === 'dressto' && (s === 'dress' || s === 'dressto'));
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

    // 2ª PASSAGEM: Se ainda houver vaga, tenta secundários ou sobra das principais (sem passar de 7)
    if (finalSelection.length < TOTAL_LINKS) {
        const allStores = [...mainStores, ...secondaryStores];
        for (const store of allStores) {
            if (finalSelection.length >= TOTAL_LINKS) break;

            // Se for secundário, respeita saldo diário
            if (secondaryStores.includes(store) && !hasDailySaldo(store)) continue;

            const nextItem = regularPool.find(p => {
                if (selectedIds.has(p.id)) return false;
                const s = (p.loja || p.brand || '').toLowerCase();
                return s === store || (store === 'dressto' && (s === 'dress' || s === 'dressto'));
            });

            if (nextItem) {
                finalSelection.push(nextItem);
                selectedIds.add(nextItem.id);
                roundCounts[store]++;
            }
        }
    }

    // 4. Preenchimento de segurança se não atingiu ~11 itens (SEM PASSAR DA QUOTA DIÁRIA)
    if (finalSelection.length < TOTAL_LINKS) {
        let gap = TOTAL_LINKS - finalSelection.length;

        // Tenta preencher primeiro com quem ainda NÃO atingiu sua quota da rodada (runQuotas)
        const priorityExtras = regularPool.filter(p => {
            if (selectedIds.has(p.id)) return false;
            const s = (p.brand || p.loja || '').toLowerCase();
            const storeKey = s === 'dress' || s === 'dressto' ? 'dressto' : s;

            const hasSaldo = hasDailySaldo(storeKey);
            const underRoundQuota = roundCounts[storeKey] < (runQuotas[storeKey] || 0);
            return hasSaldo && underRoundQuota;
        });

        priorityExtras.slice(0, gap).forEach(p => {
            finalSelection.push(p);
            selectedIds.add(p.id);
            const s = (p.brand || p.loja || '').toLowerCase();
            const storeKey = s === 'dress' || s === 'dressto' ? 'dressto' : s;
            roundCounts[storeKey]++;
        });

        // Se ainda houver gap, preenche com QUALQUER um que tenha saldo diário (Regular ou Bazar)
        if (finalSelection.length < TOTAL_LINKS) {
            gap = TOTAL_LINKS - finalSelection.length;
            const remainingExtras = eligible.filter(p => { // Alterado de regularPool para eligible
                if (selectedIds.has(p.id)) return false;
                const s = (p.brand || p.loja || '').toLowerCase();
                const storeKey = s === 'dress' || s === 'dressto' ? 'dressto' : s;
                return hasDailySaldo(storeKey);
            });

            remainingExtras.slice(0, gap).forEach(p => {
                finalSelection.push(p);
                selectedIds.add(p.id);
                const s = (p.brand || p.loja || '').toLowerCase();
                const storeKey = s === 'dress' || s === 'dressto' ? 'dressto' : s;
                roundCounts[storeKey]++;
            });
        }
    }

    return shuffle(finalSelection);
}

module.exports = { distributeLinks, QUOTAS, FARM_SUBQUOTAS, DRESS_SUBQUOTAS };
