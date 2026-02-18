const axios = require('axios');
const { getExistingIdsFromDrive } = require('../../driveManager');
const { checkFarmTimer } = require('./timer_check');
require('dotenv').config();

/**
 * Busca novidades diretamente do site (VTEX API) que NÃO estão no Google Drive.
 * @param {number} quota - Quantidade desejada.
 * @returns {Promise<Array>} - Lista de produtos formatados.
 */
async function scrapeFarmSiteNovidades(quota = 2) {
    console.log(`🌐 [FARM] Buscando ${quota} Novidades do Site (fora do Drive)...`);

    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const driveItems = await getExistingIdsFromDrive(folderId);
        const driveBaseIds = new Set(driveItems.map(item => item.id.split('_')[0]));

        const url = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search?O=OrderByReleaseDateDESC&_from=0&_to=49';

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        if (!response.data || !Array.isArray(response.data)) {
            console.log('⚠️ [FARM] Nenhum dado retornado pela API de Novidades.');
            return [];
        }

        const timerData = await checkFarmTimer();
        const finalProducts = [];

        for (const p of response.data) {
            if (finalProducts.length >= quota) break;

            const fullId = p.productReference;
            const baseId = fullId.split('_')[0];

            // 1. Filtro de Drive (evitar duplicar o que já temos no Drive)
            if (driveBaseIds.has(baseId)) continue;

            // 2. Filtro de Categoria (Apenas roupas)
            const catPath = p.categories ? p.categories.join(' ').toLowerCase() : '';
            const name = p.productName.toLowerCase();
            const pUrl = p.link.toLowerCase();
            const isAcessorio = /brinco|bolsa|colar|cinto|acessorio|culos|garrafa|copo|chaveiro|necessaire|pochete|carteira/.test(catPath + ' ' + name + ' ' + pUrl);

            if (isAcessorio) continue;

            const item = p.items[0];
            const stock = item.sellers[0].commertialOffer.AvailableQuantity;

            // 3. Filtro de Estoque
            if (stock === 0) continue;

            // 4. Filtro de Tamanhos
            const sizes = item.variations?.find(v => v.name === 'Tamanho')?.values || [];
            const hasValidSize = sizes.some(s => ['P', 'M', 'G', 'U', 'UN'].includes(s.toUpperCase()));

            if (!hasValidSize && sizes.length > 0) continue;

            // 5. Formatação do Produto
            finalProducts.push({
                nome: p.productName,
                id: baseId,
                sku: item.itemId,
                precoAtual: item.sellers[0].commertialOffer.Price,
                precoOriginal: item.sellers[0].commertialOffer.ListPrice,
                imageUrl: item.images[0].imageUrl,
                url: p.link,
                loja: 'farm',
                novidade: true,
                isNovidade: true,
                isSiteNovidade: true, // Tag para o orchestrator
                tamanhos: sizes,
                estoque: stock,
                bazar: pUrl.includes('bazar') || name.includes('bazar'),
                isBazar: pUrl.includes('bazar') || name.includes('bazar'),
                timerData: timerData
            });
        }

        console.log(`✅ [FARM] ${finalProducts.length} Novidades do Site encontradas.`);
        return finalProducts;

    } catch (err) {
        console.error('❌ [FARM] Erro ao buscar Novidades do Site:', err.message);
        return [];
    }
}

module.exports = { scrapeFarmSiteNovidades };
