/**
 * Engine de Distribuição de Links
 */

// Cotas Diárias (Base 12 links por execução)
const TOTAL_LINKS = 12;
const QUOTAS = {
    FARM: {
        percent: 0.50,
        count: 6,
        segments: {
            SITE: 1,      // 1 fixo
            BAZAR: 1,     // 1 fixo
            REGULAR: 4    // 4 fixos
        }
    },
    KJU: { percent: 0.08, count: 1 },  // 1
    DRESS: {
        percent: 0.17,
        count: 2, // 2
        segments: {
            BAZAR: 0.10,    // 10% of Dress To Quota (Bazar Drive)
            NOVIDADE: 0.10, // 10% of Dress To Quota (Site Novidades)
            REGULAR: 0.80   // 80% remaining
        }
    },
    LIVE: { percent: 0.17, count: 2 }, // 2
    ZZMALL: { percent: 0.08, count: 1 }// 1
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
function distributeLinks(allProducts) {
    const eligible = filterEligibleProducts(allProducts);
    const finalSelection = [];

    // Processamento FARM
    const farmPool = eligible.filter(p => (p.brand || '').toUpperCase() === 'FARM' || (p.loja || '').toLowerCase() === 'farm');
    const farmQuota = QUOTAS.FARM.count;

    // 1. Site Novidades (Exatamente 1)
    const farmSiteItems = farmPool.filter(p => p.isSiteNovidade);
    if (farmSiteItems.length > 0) {
        finalSelection.push(...farmSiteItems.slice(0, 1));
    }

    // 2. Bazar (Exatamente 1)
    const currentFarmIds = new Set(finalSelection.map(p => p.id));
    const farmBazarItems = farmPool.filter(p => p.bazar && !currentFarmIds.has(p.id));
    if (farmBazarItems.length > 0) {
        finalSelection.push(...farmBazarItems.slice(0, 1));
    }

    // 3. Regular (4 itens restantes, distribuídos por categoria)
    const farmRegularPool = farmPool.filter(p => !p.bazar && !p.isSiteNovidade);
    const farmRegularQuota = 4;

    // Atualiza IDs já selecionados (que podem ser site novelty ou bazar)
    const farmIdsInSelection = new Set(finalSelection.filter(p => (p.brand || '').toUpperCase() === 'FARM' || (p.loja || '').toLowerCase() === 'farm').map(p => p.id));

    // Filtra o pool regular para remover o que já foi pego (improvável se as flags forem exclusivas, mas safe)
    const availableRegular = farmRegularPool.filter(p => !farmIdsInSelection.has(p.id));

    // Distribuição proporcional por categoria para o pool regular
    for (const [cat, percent] of Object.entries(FARM_SUBQUOTAS)) {
        const count = Math.round(farmRegularQuota * percent);
        const catProducts = availableRegular.filter(p => p.categoria === cat && !finalSelection.some(fs => fs.id === p.id));
        const currentFarmCount = finalSelection.filter(p => (p.brand || '').toUpperCase() === 'FARM' || (p.loja || '').toLowerCase() === 'farm').length;
        const take = Math.min(count, farmQuota - currentFarmCount);
        if (take > 0) finalSelection.push(...catProducts.slice(0, take));
    }

    // Preenchimento de segurança para FARM (até atingir 6)
    let finalFarmCount = finalSelection.filter(p => (p.brand || '').toUpperCase() === 'FARM' || (p.loja || '').toLowerCase() === 'farm').length;
    if (finalFarmCount < farmQuota) {
        const gap = farmQuota - finalFarmCount;
        const extra = farmPool.filter(p => !finalSelection.some(fs => fs.id === p.id));
        finalSelection.push(...extra.slice(0, gap));
    }


    // Processamento Dress To (Com sub-cotas e segmentos)
    const dressQuota = QUOTAS.DRESS.count;
    const dressPool = eligible.filter(p => p.brand === 'DRESS' || p.loja === 'dressto');

    // 1. Bazar (Drive) - 10%
    const bazarQuota = Math.round(dressQuota * QUOTAS.DRESS.segments.BAZAR);
    const bazarItems = dressPool.filter(p => p.bazar);
    finalSelection.push(...bazarItems.slice(0, bazarQuota));

    // 2. Novidades (Site) - 10%
    const novidadeQuota = Math.round(dressQuota * QUOTAS.DRESS.segments.NOVIDADE);
    const novidadeItems = dressPool.filter(p => p.isSiteNovidade && !p.bazar); // Prioriza bazar se estiver em ambos (?)
    finalSelection.push(...novidadeItems.slice(0, novidadeQuota));

    // 3. Distribuição por Categoria (Restante)
    const currentDressIds = new Set(finalSelection.filter(p => p.brand === 'DRESS' || p.loja === 'dressto').map(p => p.id));
    const remainingDressPool = dressPool.filter(p => !currentDressIds.has(p.id));
    const remainingDressQuota = dressQuota - finalSelection.filter(p => p.brand === 'DRESS' || p.loja === 'dressto').length;

    for (const [cat, percent] of Object.entries(DRESS_SUBQUOTAS)) {
        const count = Math.round(dressQuota * percent);
        const catProducts = remainingDressPool.filter(p => p.categoria === cat);
        // Evita ultrapassar a quota total de Dress To se houver muitos macacões/vestidos
        const take = Math.min(count, dressQuota - finalSelection.filter(p => p.brand === 'DRESS' || p.loja === 'dressto').length);
        if (take > 0) finalSelection.push(...catProducts.slice(0, take));
    }

    // Preenchimento de segurança para Dress To (até atingir 2)
    let finalDressCount = finalSelection.filter(p => p.brand === 'DRESS' || p.loja === 'dressto').length;
    if (finalDressCount < dressQuota) {
        const gap = dressQuota - finalDressCount;
        const extra = dressPool.filter(p => !finalSelection.some(fs => fs.id === p.id));
        finalSelection.push(...extra.slice(0, gap));
    }

    // Processamento Demais Marcas
    ['KJU', 'LIVE', 'ZZMALL'].forEach(brand => {
        const quota = QUOTAS[brand].count;
        const brandProducts = eligible.filter(p => (p.brand || '').toUpperCase() === brand || (p.loja || '').toUpperCase() === brand);
        finalSelection.push(...brandProducts.slice(0, quota));
    });

    // Regra: Nunca repetir sequência (Shuffle final)
    // Retorna apenas produtos reais, sem fallbacks genéricos
    return shuffle(finalSelection);
}

module.exports = { distributeLinks, QUOTAS, FARM_SUBQUOTAS, DRESS_SUBQUOTAS };
