const axios = require('axios');
const { getExistingIdsFromDrive } = require('../../driveManager');
const { checkFarmTimer } = require('./timer_check');
const { processImageDirect } = require('../../imageDownloader');
const { isDuplicate, markAsSent } = require('../../historyManager');
require('dotenv').config();

/**
 * Busca novidades diretamente do site (VTEX API) que NÃO estão no Google Drive.
 * @param {number} quota - Quantidade desejada.
 * @returns {Promise<Array>} - Lista de produtos formatados.
 */
async function scrapeFarmSiteNovidades(quota = 2) {
    console.log(`🌐 [FARM] Buscando ${quota} Novidades do Site (fora do Drive)...`);

    try {
        const { normalizeId } = require('../../historyManager');
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const driveItems = await getExistingIdsFromDrive(folderId);
        const driveBaseIds = new Set(driveItems.map(item => normalizeId(item.id.split('_')[0])));

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
            const baseId = normalizeId(fullId.split('_')[0]);

            // 1. Filtro de Drive (evitar duplicar o que já temos no Drive)
            if (driveBaseIds.has(baseId)) {
                console.log(`      ⏭️ [FarmNovidades] Código ${baseId} já está no Drive. Pulando.`);
                continue;
            }

            // 1.1 Filtro de Histórico (evitar repetir a mesma novidade em toda rodada horária)
            if (isDuplicate(baseId)) continue;

            // 2. Filtro de Categoria (Apenas roupas)
            const catPath = p.categories ? p.categories.join(' ').toLowerCase() : '';
            const name = p.productName.toLowerCase();
            const pUrl = p.link.toLowerCase();
            const isAcessorio = /brinco|pulseira|colar|bolsa|colar|cinto|acessorio|culos|garrafa|copo|chaveiro|necessaire|pochete|carteira/.test(catPath + ' ' + name + ' ' + pUrl);

            if (isAcessorio) continue;

            const item = p.items[0];
            const stock = item.sellers[0].commertialOffer.AvailableQuantity;

            // 3. Filtro de Estoque
            if (stock === 0) continue;

            // 4. Filtro de Tamanhos (Verifica todos os SKUs disponíveis)
            const availableSizes = new Set();
            p.items.forEach(itm => {
                const itmStock = itm.sellers?.[0]?.commertialOffer?.AvailableQuantity || 0;
                if (itmStock > 0) {
                    const sValues = itm['Tamanho'] || [];
                    sValues.forEach(sv => availableSizes.add(sv.toUpperCase().trim()));
                }
            });

            const uniqueSizesList = Array.from(availableSizes);
            const isOnlyPP = uniqueSizesList.length === 1 && uniqueSizesList[0] === 'PP';
            const isOnlyGG = uniqueSizesList.length === 1 && uniqueSizesList[0] === 'GG';

            if (isOnlyPP || isOnlyGG) continue;
            if (uniqueSizesList.length === 0) continue;

            // 5. Upload da imagem para Cloudinary
            let imagePath = item.images[0].imageUrl;
            try {
                const imgResult = await processImageDirect(item.images[0].imageUrl, 'FARM', baseId);
                if (imgResult.status === 'success' && imgResult.cloudinary_urls.length > 0) {
                    imagePath = imgResult.cloudinary_urls[0];
                }
            } catch (err) {
                console.error(`⚠️ [FARM] Erro no upload Cloudinary para ${baseId}:`, err.message);
            }

            // 6. Formatação do Produto
            const product = {
                nome: p.productName,
                id: baseId,
                sku: item.itemId,
                precoAtual: item.sellers[0].commertialOffer.Price,
                precoOriginal: item.sellers[0].commertialOffer.ListPrice,
                imageUrl: item.images[0].imageUrl,
                imagePath: imagePath,
                url: p.link,
                loja: 'farm',
                novidade: true,
                isNovidade: true,
                isSiteNovidade: true, // Tag para o orchestrator
                tamanhos: uniqueSizesList,
                estoque: stock,
                bazar: false, // strictly from photo filenames in idScanner
                isBazar: false,
                timerData: timerData
            };

            finalProducts.push(product);
            markAsSent([baseId]); // Marca no histórico para não repetir na próxima execução
        }

        console.log(`✅ [FARM] ${finalProducts.length} Novidades do Site encontradas (Cloudinary + Histórico OK).`);
        return finalProducts;

    } catch (err) {
        console.error('❌ [FARM] Erro ao buscar Novidades do Site:', err.message);
        return [];
    }
}

module.exports = { scrapeFarmSiteNovidades };
