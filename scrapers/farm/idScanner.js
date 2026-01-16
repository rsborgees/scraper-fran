const { parseProduct } = require('./parser');
const { appendQueryParams } = require('../../urlUtils');
const { normalizeId, isDuplicate, markAsSent } = require('../../historyManager');

/**
 * Scraper focado em IDs específicos (vindos do Drive)
 * @param {object} browser Playwright Browser instance
 * @param {Array} driveItems Lista de objetos { id, driveUrl, isFavorito, ... }
 */
async function scrapeSpecificIds(contextOrBrowser, driveItems, quota = 999) {
    console.log(`\n🚙 INICIANDO SCRAPE DRIVE-FIRST (${driveItems.length} itens disponíveis, meta: ${quota})...`);

    const page = await contextOrBrowser.newPage();
    const collectedProducts = [];

    // Stats Tracking
    const attemptedIds = [];
    const stats = {
        checked: 0,
        found: 0,
        notFound: 0,
        duplicates: 0,
        errors: 0
    };

    try {
        for (const item of driveItems) {
            // Stop if quota reached
            if (collectedProducts.length >= quota) {
                console.log(`   ✅ Meta de ${quota} itens do Drive atingida.`);
                break;
            }

            attemptedIds.push(item.id);
            stats.checked++;

            // 1. Navega para a home (UMA VEZ) - Mantemos para garantir contexto e cookies se necessário
            if (stats.checked === 1) {
                await page.goto(`https://www.farmrio.com.br`, { waitUntil: 'domcontentloaded', timeout: 45000 });
            }

            const idsToSearch = item.ids || [item.id];
            console.log(`\n🔍 [${stats.checked}/${driveItems.length}] Buscando ${item.isSet ? 'CONJUNTO' : 'ID'} ${idsToSearch.join(' ')} (Favorito: ${item.isFavorito})...`);

            const mergedProducts = [];
            let itemHasError = false;
            let itemNotFound = false;

            for (const id of idsToSearch) {
                try {
                    console.log(`   🔎 Buscando sub-item ${id} via API...`);

                    // API Call
                    const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}`;
                    const response = await page.goto(apiUrl);
                    let productsJson = [];

                    try {
                        productsJson = await response.json();
                    } catch (e) {
                        // Fallback: às vezes retorna HTML se der erro, mas API deve retornar JSON
                        const text = await page.evaluate(() => document.body.innerText);
                        try { productsJson = JSON.parse(text); } catch (e2) { }
                    }

                    if (!productsJson || productsJson.length === 0) {
                        console.log(`      ⚠️ ID ${id} não encontrado na API.`);
                        itemNotFound = true;
                        continue;
                    }

                    // Encontrou! Pega o primeiro link
                    const productData = productsJson[0];
                    console.log(`      🎯 Encontrado na API: ${productData.productName}`);

                    const productLink = productData.link;
                    if (!productLink) {
                        console.error(`      ❌ Link não encontrado no JSON da API.`);
                        itemHasError = true;
                        continue;
                    }

                    // Navega para a página do produto
                    await page.goto(productLink, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    const url = page.url();
                    const product = await parseProduct(page, url);

                    if (product) {
                        mergedProducts.push(product);
                    } else {
                        throw new Error('Falha ao fazer parse do produto (Parse retornou null)');
                    }

                } catch (apiErr) {
                    console.log(`      ❌ Erro API/Parse ${id}: ${apiErr.message}`);
                    itemHasError = true;
                }
            }

            if (mergedProducts.length > 0) {
                let finalProduct;

                if (mergedProducts.length > 1) {
                    console.log(`   🔗 Consolidando conjunto completo com ${mergedProducts.length} itens.`);
                    finalProduct = {
                        ...mergedProducts[0],
                        id: mergedProducts.map(p => p.id).join('_'),
                        nome: mergedProducts.map(p => p.nome).join(' + '),
                        precoAtual: parseFloat(mergedProducts.reduce((sum, p) => sum + p.precoAtual, 0).toFixed(2)),
                        precoOriginal: parseFloat(mergedProducts.reduce((sum, p) => sum + (p.precoOriginal || p.precoAtual), 0).toFixed(2)),
                        isSet: true
                    };
                } else {
                    finalProduct = mergedProducts[0];
                }

                if (item.driveUrl && item.driveUrl.includes('drive.google.com')) {
                    finalProduct.imageUrl = item.driveUrl;
                    finalProduct.imagePath = item.driveUrl;
                } else {
                    finalProduct.imagePath = finalProduct.imagePath || 'error.jpg';
                }

                finalProduct.favorito = item.isFavorito || false;
                finalProduct.url = appendQueryParams(finalProduct.url, { utm_campaign: "7B1313" });
                finalProduct.loja = 'farm';

                const isDup = isDuplicate(normalizeId(finalProduct.id), { force: item.isFavorito }, finalProduct.preco);

                if (!isDup) {
                    collectedProducts.push(finalProduct);
                    stats.found++;
                    console.log(`   ✅ Capturado: ${finalProduct.nome}`);

                    const allIds = mergedProducts.map(p => p.id);
                    markAsSent(allIds);
                    if (mergedProducts.length > 1) markAsSent([finalProduct.id]);
                } else {
                    console.log(`   ⏭️  Skip: Duplicado no histórico.`);
                    stats.duplicates++;
                }
            } else {
                if (itemNotFound) stats.notFound++;
                else if (itemHasError) stats.errors++;
                else stats.notFound++;
            }

            // Delay suave
            await new Promise(r => setTimeout(r, 1000));
        }

    } catch (globalErr) {
        console.error('❌ Erro crítico no Scrape Drive-First:', globalErr.message);
    } finally {
        await page.close();
    }

    console.log(`🚙 DRIVE-FIRST FINALIZADO: ${collectedProducts.length} itens recuperados.`);
    console.log(`📊 Stats: ${stats.found} ok, ${stats.notFound} não encontrados, ${stats.duplicates} duplicados, ${stats.errors} erros.\n`);

    return {
        products: collectedProducts,
        attemptedIds: attemptedIds,
        stats: stats
    };
}

module.exports = { scrapeSpecificIds };
