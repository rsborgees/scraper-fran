/**
 * Utilitário para manipulação segura de URLs.
 */

/**
 * Adiciona parâmetros de consulta a uma URL de forma robusta.
 * Garante que não haja duplicidade de "?" e preserva parâmetros existentes.
 * 
 * @param {string} url - A URL original.
 * @param {Object} params - Objeto com chave-valor dos parâmetros a adicionar.
 * @returns {string} - A URL formatada.
 */
function appendQueryParams(url, params) {
    try {
        const urlObj = new URL(url);
        Object.entries(params).forEach(([key, value]) => {
            urlObj.searchParams.set(key, value);
        });
        return urlObj.toString();
    } catch (e) {
        // Fallback para strings que não são URLs completas ou erro de parsing
        let finalUrl = url;
        Object.entries(params).forEach(([key, value]) => {
            const separator = finalUrl.includes('?') ? '&' : '?';
            // Evita duplicar se o parâmetro já existir de forma simples
            if (!finalUrl.includes(`${key}=`)) {
                finalUrl += `${separator}${key}=${value}`;
            }
        });
        return finalUrl;
    }
}

module.exports = { appendQueryParams };
