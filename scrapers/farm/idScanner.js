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

    const collectedProducts = [];
    const attemptedIds = [];
    const stats = {
        checked: 0,
        found: 0,
        notFound: 0,
        duplicates: 0,
        errors: 0
    };

    // CONCURRENCY SETTINGS
    const CONCURRENCY_LIMIT = 5;
    const itemQueue = [...driveItems];
    let isQuotaReached = false;

    // Worker Function
    const worker = async (workerId) => {
        const page = await contextOrBrowser.newPage();

        // Setup Page
        await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

        try {
            // Context navigation (first time)
            if (workerId === 1) {
                try {
                    await page.goto(`https://www.farmrio.com.br`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                } catch (e) {
                    console.log(`⚠️ Worker ${workerId}: Erro ao acessar home (Ignorando): ${e.message}`);
                }
            }

            while (itemQueue.length > 0 && !isQuotaReached) {
                if (collectedProducts.length >= quota) {
                    isQuotaReached = true;
                    break;
                }

                const item = itemQueue.shift();
                if (!item) break;

                attemptedIds.push(item.id);
                stats.checked++; // Note: Not thread-safe for exact count during run but sufficient for stats

                const idsToSearch = item.ids || [item.id];
                console.log(`\n🔍 [Worker ${workerId}] Buscando ${item.isSet ? 'CONJUNTO' : 'ID'} ${idsToSearch.join(' ')} (Favorito: ${item.isFavorito})...`);

                const mergedProducts = [];
                let itemHasError = false;
                let itemNotFound = false;

                for (const id of idsToSearch) {
                    try {
                        const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}`;
                        const response = await page.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                        let productsJson = [];

                        try {
                            productsJson = await response.json();
                        } catch (e) {
                            const text = await page.evaluate(() => document.body.innerText);
                            try { productsJson = JSON.parse(text); } catch (e2) { }
                        }

                        // Check if JSON exists and has items
                        if (!productsJson || productsJson.length === 0) {
                            console.log(`      ⚠️ [Worker ${workerId}] ID ${id} não encontrado na API.`);
                            itemNotFound = true;
                            continue;
                        }

                        const productData = productsJson[0];
                        // Validate availability in JSON if possible to skip navigation?
                        // Farm JSON usually has 'items' array with 'sellers' and 'commertialOffer'.
                        // But let's stick to existing logic: navigate to link.

                        const productLink = productData.link;
                        if (!productLink) {
                            console.error(`      ❌ [Worker ${workerId}] Link não encontrado no JSON.`);
                            itemHasError = true;
                            continue;
                        }

                        await page.goto(productLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        const product = await parseProduct(page, page.url());

                        if (product) {
                            mergedProducts.push(product);
                        } else {
                            // Explicitly check for "Out of Stock" signal from parser (usually null)
                            // The parser logs "Descartado: Produto ESGOTADO"
                        }

                    } catch (err) {
                        console.log(`      ❌ [Worker ${workerId}] Erro ${id}: ${err.message}`);
                        itemHasError = true;
                    }
                } // End sub-item loop

                if (mergedProducts.length > 0) {
                    let finalProduct;

                    if (mergedProducts.length > 1) {
                        finalProduct = {
                            ...mergedProducts[0],
                            id: mergedProducts.map(p => p.id).join('_'),
                            nome: mergedProducts.map(p => p.nome).join(' + '),
                            precoAtual: parseFloat(mergedProducts.reduce((sum, p) => sum + p.precoAtual, 0).toFixed(2)),
                            precoOriginal: parseFloat(mergedProducts.reduce((sum, p) => sum + (p.precoOriginal || p.precoAtual), 0).toFixed(2)),
                            isSet: true,
                            items: mergedProducts
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
                    finalProduct.isFavorito = item.isFavorito || false;
                    finalProduct.novidade = item.novidade || false;
                    finalProduct.isNovidade = item.novidade || (finalProduct.isNovidade || false);
                    finalProduct.bazar = item.bazar || false;
                    finalProduct.bazarFavorito = item.bazarFavorito || false;

                    finalProduct.url = appendQueryParams(finalProduct.url, { utm_campaign: "7B1313" });
                    finalProduct.loja = 'farm';

                    const isDup = isDuplicate(normalizeId(finalProduct.id), { force: item.isFavorito, maxAgeHours: 48 }, finalProduct.preco);

                    if (!isDup) {
                        collectedProducts.push(finalProduct);
                        stats.found++;
                        console.log(`   ✅ [Worker ${workerId}] Capturado: ${finalProduct.nome}`);

                        const allIds = mergedProducts.map(p => p.id);
                        markAsSent(allIds);
                        if (mergedProducts.length > 1) markAsSent([finalProduct.id]);
                    } else {
                        console.log(`   ⏭️  [Worker ${workerId}] Skip: Duplicado.`);
                        stats.duplicates++;
                    }
                } else {
                    if (itemNotFound) stats.notFound++;
                    else if (itemHasError) stats.errors++;
                    else stats.notFound++; // Parse failed = likely OOS
                }

                // Small delay between items primarily to breathe
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (workerErr) {
            console.error(`❌ Worker ${workerId} Crashed: ${workerErr.message}`);
        } finally {
            await page.close();
        }
    };

    // Validar driveItems
    if (!driveItems || driveItems.length === 0) {
        console.log('⚠️ Nenhum item para processar no Drive.');
        return { products: [], attemptedIds: [], stats };
    }

    // Iniciar Workers
    console.log(`🚀 Iniciando ${Math.min(driveItems.length, CONCURRENCY_LIMIT)} workers simultâneos...`);
    const workers = [];
    for (let i = 0; i < Math.min(driveItems.length, CONCURRENCY_LIMIT); i++) {
        workers.push(worker(i + 1));
    }

    await Promise.all(workers);

    console.log(`🚙 DRIVE-FIRST FINALIZADO: ${collectedProducts.length} itens recuperados.`);
    console.log(`📊 Stats: ${stats.found} ok, ${stats.notFound} não encontrados, ${stats.duplicates} duplicados, ${stats.errors} erros.\n`);

    return {
        products: collectedProducts,
        attemptedIds: attemptedIds,
        stats: stats
    };
}
module.exports = { scrapeSpecificIds };
