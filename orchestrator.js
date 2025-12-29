/**
 * Orchestrator - Coordena todos os scrapers de lojas
 * Total: 120 produtos
 * Distribuição: FARM 84, Dress To 18, KJU 6, Live 6, ZZMall 6
 */

const { processProductUrl } = require('./imageDownloader');

async function runAllScrapers() {
    console.log('🚀 INICIANDO ORCHESTRATOR - 120 PRODUTOS TOTAL\n');
    console.log('Distribuição: FARM 70% (84), Dress To 15% (18), KJU/Live/ZZMall 5% cada (6)\n');

    const allProducts = [];
    const quotas = {
        farm: 84,
        dressto: 18,
        kju: 6,
        live: 6,
        zzmall: 6
    };

    async function processImagesForProducts(products) {
        for (const p of products) {
            try {
                if (!p.url) continue;

                console.log(`🖼️  Baixando imagem de: ${p.url}`);

                const imgResult = await processProductUrl(p.url);

                if (imgResult.status === 'success' && imgResult.path.length > 0) {
                    // salva o caminho da imagem no produto
                    p.imagePath = imgResult.path[0];
                    p.imageId = imgResult.id;
                    console.log(`   ✔️  Imagem salva: ${p.imagePath}`);
                } else {
                    console.log(`   ⚠️  Não foi possível baixar imagem para esse produto.`);
                }
            } catch (err) {
                console.log(`   ❌ Erro ao baixar imagem: ${err.message}`);
            }
        }

        return products;
    }

    // FARM
    try {
        const { scrapeFarm } = require('./scrapers/farm');
        let farmProducts = await scrapeFarm(quotas.farm);
        farmProducts = await processImagesForProducts(farmProducts);
        allProducts.push(...farmProducts);
        console.log(`✅ FARM completo: ${farmProducts.length} produtos\n`);
    } catch (error) {
        console.error(`❌ Erro no scraper FARM: ${error.message}\n`);
    }

    // Dress To
    try {
        const { scrapeDressTo } = require('./scrapers/dressto');
        let dresstoProducts = await scrapeDressTo(quotas.dressto);
        dresstoProducts = await processImagesForProducts(dresstoProducts);
        allProducts.push(...dresstoProducts);
        console.log(`✅ Dress To completo: ${dresstoProducts.length} produtos\n`);
    } catch (error) {
        console.error(`❌ Erro no scraper Dress To: ${error.message}\n`);
    }

    // KJU
    try {
        const { scrapeKJU } = require('./scrapers/kju');
        let kjuProducts = await scrapeKJU(quotas.kju);
        kjuProducts = await processImagesForProducts(kjuProducts);
        allProducts.push(...kjuProducts);
        console.log(`✅ KJU completo: ${kjuProducts.length} produtos\n`);
    } catch (error) {
        console.error(`❌ Erro no scraper KJU: ${error.message}\n`);
    }

    // Live
    try {
        const { scrapeLive } = require('./scrapers/live');
        let liveProducts = await scrapeLive(quotas.live);
        liveProducts = await processImagesForProducts(liveProducts);
        allProducts.push(...liveProducts);
        console.log(`✅ Live completo: ${liveProducts.length} produtos\n`);
    } catch (error) {
        console.error(`❌ Erro no scraper Live: ${error.message}\n`);
    }

    // ZZMall
    try {
        const { scrapeZZMall } = require('./scrapers/zzmall');
        let zzmallProducts = await scrapeZZMall(quotas.zzmall);
        zzmallProducts = await processImagesForProducts(zzmallProducts);
        allProducts.push(...zzmallProducts);
        console.log(`✅ ZZMall completo: ${zzmallProducts.length} produtos\n`);
    } catch (error) {
        console.error(`❌ Erro no scraper ZZMall: ${error.message}\n`);
    }

    console.log('\n==================================================');
    console.log('RESULTADO FINAL - TODAS AS LOJAS');
    console.log('==================================================');
    console.log(`Total de produtos: ${allProducts.length}/120`);

    const byStore = {};
    allProducts.forEach(p => {
        if (!byStore[p.loja]) byStore[p.loja] = 0;
        byStore[p.loja]++;
    });

    console.log('\nDistribuição por loja:');
    Object.keys(byStore).forEach(loja => {
        console.log(`  ${loja}: ${byStore[loja]} produtos`);
    });

    return allProducts;
}

module.exports = { runAllScrapers };
