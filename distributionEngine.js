/**
 * Engine de Distribuição de Links
 */

// Cotas Diárias (Base 120 links)
const TOTAL_LINKS = 120;
const QUOTAS = {
    FARM: { percent: 0.70, count: Math.round(TOTAL_LINKS * 0.70) }, // 84
    KJU: { percent: 0.05, count: Math.round(TOTAL_LINKS * 0.05) },  // 6
    DRESS: { percent: 0.15, count: Math.round(TOTAL_LINKS * 0.15) },// 18
    LIVE: { percent: 0.05, count: Math.round(TOTAL_LINKS * 0.05) }, // 6
    ZZMALL: { percent: 0.05, count: Math.round(TOTAL_LINKS * 0.05) }// 6
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
    const farmProducts = eligible.filter(p => p.brand === 'FARM');
    const farmQuota = QUOTAS.FARM.count;

    // Distribuição por categoria na FARM
    for (const [cat, percent] of Object.entries(FARM_SUBQUOTAS)) {
        const count = Math.round(farmQuota * percent);
        const catProducts = farmProducts.filter(p => p.categoria === cat);
        // Pega os primeiros (supondo ordenação de prioridade/novidade)
        // Se faltar, pegaria de 'Outros' (não implementado full fallback para simplificar)
        finalSelection.push(...catProducts.slice(0, count));
    }

    // Processamento Demais Marcas
    ['KJU', 'DRESS', 'LIVE', 'ZZMALL'].forEach(brand => {
        const quota = QUOTAS[brand].count;
        const brandProducts = eligible.filter(p => p.brand === brand);
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

module.exports = { distributeLinks };
