/**
 * Engine de Distribuição de Links
 */

// Cotas Diárias (Base ~7 links por execução para atingir 106/dia em 15 horários)
const TOTAL_LINKS = 7;
const QUOTAS = {
    // Farm (56), others split remaining 50
    FARM: {
        percent: 0.53,
        count: 4, // Per execution target
        dailyGoal: 56
    },
    DRESS: {
        percent: 0.17,
        count: 1.2,
        dailyGoal: 18
    },
    KJU: {
        percent: 0.17,
        count: 1.2,
        dailyGoal: 18
    },
    LIVE: {
        percent: 0.11,
        count: 0.8,
        dailyGoal: 12
    },
    ZZMALL: {
        percent: 0.02,
        count: 0.13,
        dailyGoal: 2
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
    // Mock de verificação de histórico (implementação real verificaria DB)
    return products.filter(p => {
        // Regra: > R$1000 = 1x por mês
        if (p.precoAtual > 1000) {
            // Retornaria false se já enviado nos ultimos 30 dias
            // Aqui assumimos true para teste
            return true;
        }
        return true;
    });
}

/**
 * Distribui produtos nos slots disponíveis
 * @param {Array} allProducts Array de objetos de produto { nome, categoria, brand, ... }
 */
/**
 * Distribui produtos nos slots disponíveis
 * @param {Array} allProducts Array de objetos de produto
 */
function distributeLinks(allProducts) {
    // 1. FILTRO: Remove Favoritos e Novidades (Não devem ir no horário)
    const eligible = allProducts.filter(p => !p.favorito && !p.isFavorito && !p.novidade && !p.isNovidade);

    const finalSelection = [];

    // 2. SELEÇÃO BAZAR (Exatamente 1 item por execução, prioridade FARM)
    const bazarPool = eligible.filter(p => p.bazar);
    if (bazarPool.length > 0) {
        // Prioriza Farm se houver
        const farmBazar = bazarPool.find(p => p.loja === 'farm' || p.brand === 'FARM');
        if (farmBazar) {
            finalSelection.push(farmBazar);
        } else {
            finalSelection.push(bazarPool[0]);
        }
    }

    // 3. SELEÇÃO REGULAR (9-10 itens restantes)
    const regularPool = eligible.filter(p => !p.bazar);
    const selectedIds = new Set(finalSelection.map(p => p.id));

    // Preenche por loja respeitando proporção (Simples)
    const storePriority = ['farm', 'dressto', 'kju', 'live', 'zzmall'];

    for (const store of storePriority) {
        const quota = QUOTAS[store === 'dressto' ? 'DRESS' : store.toUpperCase()].count;
        const countToTake = Math.ceil(quota);

        const storeItems = regularPool.filter(p => (p.loja === store || (p.brand || '').toLowerCase() === store) && !selectedIds.has(p.id));

        // Se FARM, aplica sub-cotas categoria (60/25/15)
        if (store === 'farm') {
            const farmVestidos = storeItems.filter(p => p.categoria === 'vestido').slice(0, Math.ceil(countToTake * 0.60));
            const farmMacacoes = storeItems.filter(p => p.categoria === 'macacão').slice(0, Math.ceil(countToTake * 0.25));
            const farmOutros = storeItems.filter(p => p.categoria !== 'vestido' && p.categoria !== 'macacão').slice(0, Math.ceil(countToTake * 0.15));

            [...farmVestidos, ...farmMacacoes, ...farmOutros].forEach(p => {
                if (finalSelection.length < 8) { // Cap global ~7
                    finalSelection.push(p);
                    selectedIds.add(p.id);
                }
            });
        } else {
            storeItems.slice(0, countToTake).forEach(p => {
                if (finalSelection.length < 8) {
                    finalSelection.push(p);
                    selectedIds.add(p.id);
                }
            });
        }
    }

    // Preenchimento de segurança se não atingiu 7
    if (finalSelection.length < 7) {
        const gap = 7 - finalSelection.length;
        const extras = regularPool.filter(p => !selectedIds.has(p.id));
        finalSelection.push(...extras.slice(0, gap));
    }

    return shuffle(finalSelection);
}

module.exports = { distributeLinks, QUOTAS, FARM_SUBQUOTAS, DRESS_SUBQUOTAS };
