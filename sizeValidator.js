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

    // Standard sizes that indicate the item is acceptable
    const standardSizes = ['P', 'M', 'G'];

    // Numeric sizes (clothing sizes 34-46)
    const numericSizePattern = /^(3[4-9]|4[0-6])$/;

    // Check if at least one standard size exists
    const hasStandard = tamanhos.some(size => {
        const normalized = size.toUpperCase().trim();

        // Check for letter sizes P, M, G
        if (standardSizes.includes(normalized)) {
            return true;
        }

        // Check for numeric sizes (34-46)
        if (numericSizePattern.test(normalized)) {
            return true;
        }

        return false;
    });

    return hasStandard;
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
    return `Apenas tamanhos extremos disponíveis (${sizesStr}) - necessário P, M ou G`;
}

module.exports = {
    hasStandardSizes,
    getSizeRejectionReason
};
