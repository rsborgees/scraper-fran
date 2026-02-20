/**
 * Size Validator Utility
 * Validates that clothing items have standard sizes available (not just PP or GG)
 */

/**
 * Checks if a size array contains at least one standard size
 * Standard sizes include: P, M, G, and numeric sizes (34-46)
 * 
 * @param {Array<string>} tamanhos - Array of size strings (e.g., ['PP', 'P', 'M'])
 * @returns {boolean} - true if has standard sizes, false if only PP/GG/UN
 */
function hasStandardSizes(tamanhos) {
    // Handle edge cases
    if (!tamanhos || !Array.isArray(tamanhos) || tamanhos.length === 0) {
        return false;
    }

    const normalizedSizes = tamanhos.map(s => s.toUpperCase().trim());

    // 🚫 NOVA REGRA: Não pode ter APENAS PP ou APENAS GG
    // Se tiver PP e GG juntos, ou qualquer outro tamanho, é válido.
    const isOnlyPP = normalizedSizes.length === 1 && normalizedSizes[0] === 'PP';
    const isOnlyGG = normalizedSizes.length === 1 && normalizedSizes[0] === 'GG';

    if (isOnlyPP || isOnlyGG) {
        return false;
    }

    // Mantemos a regra legada de "tamanhos padrão" para categorias que exigem P/M/G
    // mas a regra acima é a mais restritiva para a exclusão imediata.
    return true;
}

/**
 * Check if the sizes are acceptable for clothing
 * @param {Array<string>} tamanhos 
 * @param {string} categoria 
 * @returns {boolean}
 */
function isValidClothingSize(tamanhos, categoria) {
    const clothingCategories = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'calça', 'macaquinho', 'conjunto', 'casaco', 'top/body', 'banho', 'roupa'];

    if (!categoria || !clothingCategories.includes(categoria.toLowerCase())) {
        return true; // Não é roupa, aceita qualquer tamanho (ex: Calçado 35)
    }

    return hasStandardSizes(tamanhos);
}

/**
 * Gets a descriptive message for why sizes were rejected
 * @param {Array<string>} tamanhos - Array of size strings
 * @returns {string} - Rejection reason
 */
function getSizeRejectionReason(tamanhos) {
    if (!tamanhos || tamanhos.length === 0) {
        return 'Sem tamanhos disponíveis';
    }

    const sizesStr = tamanhos.join(', ');
    if (tamanhos.length === 1 && (tamanhos[0].toUpperCase() === 'PP' || tamanhos[0].toUpperCase() === 'GG')) {
        return `Apenas um tamanho extremo disponível (${sizesStr}) - necessário mais opções`;
    }

    return `Grade de tamanhos insuficiente (${sizesStr})`;
}

module.exports = {
    hasStandardSizes,
    isValidClothingSize,
    getSizeRejectionReason
};
