/**
 * Engine de Distribuição de Links
 */

// Cotas Diárias (Base 10 links por execução)
const TOTAL_LINKS = 10;
const QUOTAS = {
    FARM: {
        percent: 0.50,
        count: 5,
        segments: {
            SITE: 0.10,    // 10% of Farm Quota (Site Novidades)
            REGULAR: 0.90  // 90% remaining (Drive)
        }
    },
    KJU: { percent: 0.10, count: 1 },  // 1
    DRESS: {
        percent: 0.20,
        count: 2, // 2
        segments: {
            BAZAR: 0.10,    // 10% of Dress To Quota (Bazar Drive)
            NOVIDADE: 0.10, // 10% of Dress To Quota (Site Novidades)
            REGULAR: 0.80   // 80% remaining
        }
    },
    LIVE: { percent: 0.10, count: 1 }, // 1
    ZZMALL: { percent: 0.10, count: 1 }// 1
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

    // 1. Site Novidades (Pelo menos 10% da cota da Farm)
    const farmSiteQuota = Math.round(farmQuota * QUOTAS.FARM.segments.SITE) || 1;
    const farmSiteItems = farmPool.filter(p => p.isSiteNovidade);
    finalSelection.push(...farmSiteItems.slice(0, farmSiteQuota));

    // 2. Distribuição por Categoria (Drive/Regular)
    const currentFarmIds = new Set(finalSelection.filter(p => (p.brand || '').toUpperCase() === 'FARM' || (p.loja || '').toLowerCase() === 'farm').map(p => p.id));
    const remainingFarmPool = farmPool.filter(p => !currentFarmIds.has(p.id));
    const remainingFarmQuota = farmQuota - finalSelection.filter(p => (p.brand || '').toUpperCase() === 'FARM' || (p.loja || '').toLowerCase() === 'farm').length;

    if (remainingFarmQuota > 0) {
        for (const [cat, percent] of Object.entries(FARM_SUBQUOTAS)) {
            const count = Math.round(farmQuota * percent);
            const catProducts = remainingFarmPool.filter(p => p.categoria === cat);
            const take = Math.min(count, farmQuota - finalSelection.filter(p => (p.brand || '').toUpperCase() === 'FARM' || (p.loja || '').toLowerCase() === 'farm').length);
            if (take > 0) finalSelection.push(...catProducts.slice(0, take));
        }

        // Preenchimento de segurança se as categorias não bastarem
        const finalFarmCount = finalSelection.filter(p => (p.brand || '').toUpperCase() === 'FARM' || (p.loja || '').toLowerCase() === 'farm').length;
        if (finalFarmCount < farmQuota) {
            const gap = farmQuota - finalFarmCount;
            const extra = remainingFarmPool.filter(p => !finalSelection.some(fs => fs.id === p.id));
            finalSelection.push(...extra.slice(0, gap));
        }
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

    // Processamento Demais Marcas
    ['KJU', 'LIVE', 'ZZMALL'].forEach(brand => {
        const quota = QUOTAS[brand].count;
        const brandProducts = eligible.filter(p => (p.brand || '').toUpperCase() === brand || (p.loja || '').toUpperCase() === brand);
        finalSelection.push(...brandProducts.slice(0, quota));
    });

    // Se faltou preencher (arredondamentos), completa com aleatórios
    while (finalSelection.length < TOTAL_LINKS) {
        // Fallback simples
        finalSelection.push({ nome: 'Fallback Product', brand: 'GENERIC' });
    }

    // Regra: Nunca repetir sequência (Shuffle final)
    return shuffle(finalSelection);
}

module.exports = { distributeLinks, QUOTAS, FARM_SUBQUOTAS, DRESS_SUBQUOTAS };
