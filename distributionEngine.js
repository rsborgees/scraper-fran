/**
 * Engine de Distribuição de Links
 */

// Cotas Diárias (Base ~7 links por execução para atingir 106/dia em 15 horários)
const TOTAL_LINKS = 7;
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
    console.log(`📊 [Distribution] Pool de Bazar: ${bazarPool.length} itens.`);
    if (bazarPool.length > 0) {
        // Prioriza Farm se houver bazar e se Farm tiver saldo
        const farmBazar = bazarPool.find(p => (p.loja === 'farm' || p.brand === 'FARM') && hasDailySaldo('farm'));
        let selectedBazar = null;

        if (farmBazar) {
            selectedBazar = farmBazar;
        } else {
            // Pega o primeiro bazar disponível de uma loja que tenha saldo diário
            selectedBazar = bazarPool.find(p => {
                const s = (p.brand || p.loja || '').toLowerCase();
                const storeKey = s === 'dress' || s === 'dressto' ? 'dressto' : s;
                return hasDailySaldo(storeKey);
            });
        }

        if (selectedBazar) {
            console.log(`✅ [Distribution] Selecionado Bazaar: ${selectedBazar.nome} (${selectedBazar.id})`);
            finalSelection.push(selectedBazar);
            selectedIds.add(selectedBazar.id);
            const s = (selectedBazar.brand || selectedBazar.loja || '').toLowerCase();
            const storeKey = s === 'dress' || s === 'dressto' ? 'dressto' : s;
            if (roundCounts[storeKey] !== undefined) roundCounts[storeKey]++;
        } else {
            console.log(`⚠️ [Distribution] Nenhum item do Bazar pool foi selecionado (saldo esgotado?).`);
        }
    }

    // 3. SELEÇÃO REGULAR (Até atingir TOTAL_LINKS)
    const regularPool = eligible.filter(p => !p.bazar);
    const storePriority = ['farm', 'dressto', 'kju', 'live', 'zzmall'];

    for (const store of storePriority) {
        // Usa quota calculada pelo orchestrator (runQuotas) ou o default hardcoded
        const targetForRun = runQuotas[store] !== undefined
            ? runQuotas[store]
            : Math.ceil(QUOTAS[store === 'dressto' ? 'DRESS' : store.toUpperCase()].count);

        // Quanto levar desta loja, respeitando o saldo diário
        let countToTake = Math.min(targetForRun, Math.max(0, (dailyRemaining && dailyRemaining.stores ? dailyRemaining.stores[store] : 999) - roundCounts[store]));
        if (countToTake <= 0) continue;

        const storeItems = regularPool.filter(p => {
            const s = (p.loja || p.brand || '').toLowerCase();
            const matches = (s === store || (store === 'dressto' && (s === 'dress' || s === 'dressto')));
            return matches && !selectedIds.has(p.id);
        });

        // Se FARM, aplica sub-cotas categoria (60/25/15)
        if (store === 'farm') {
            const farmVestidos = storeItems.filter(p => p.categoria === 'vestido').slice(0, Math.ceil(countToTake * 0.60));
            const farmMacacoes = storeItems.filter(p => p.categoria === 'macacão').slice(0, Math.ceil(countToTake * 0.25));
            const farmOutros = storeItems.filter(p => p.categoria !== 'vestido' && p.categoria !== 'macacão').slice(0, Math.ceil(countToTake * 0.15));

            const selected = [...farmVestidos, ...farmMacacoes, ...farmOutros].slice(0, countToTake);
            selected.forEach(p => {
                finalSelection.push(p);
                selectedIds.add(p.id);
                roundCounts.farm++;
            });
        } else {
            storeItems.slice(0, countToTake).forEach(p => {
                finalSelection.push(p);
                selectedIds.add(p.id);
                roundCounts[store]++;
            });
        }
    }

    // 4. Preenchimento de segurança se não atingiu ~7 itens (SEM PASSAR DA QUOTA DIÁRIA)
    if (finalSelection.length < 7) {
        let gap = 7 - finalSelection.length;

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

        // Se ainda houver gap, preenche com QUALQUER um que tenha saldo diário
        if (finalSelection.length < 7) {
            gap = 7 - finalSelection.length;
            const remainingExtras = regularPool.filter(p => {
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
