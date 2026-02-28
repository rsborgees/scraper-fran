const { parseProduct } = require('./parser');
const { appendQueryParams } = require('../../urlUtils');
const { normalizeId, isDuplicate, markAsSent } = require('../../historyManager');

/**
 * Scraper focado em IDs específicos (vindos do Drive)
 * @param {object} contextOrBrowser Playwright Browser instance
 * @param {Array} driveItems Lista de objetos { id, driveUrl, isFavorito, ... }
 * @param {number} quota Meta de itens coletados
 * @param {object} options Opções extras (maxAgeHours, etc.)
 */
async function scrapeSpecificIds(contextOrBrowser, driveItems, quota = 999, options = {}) {
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
            try {
                console.log(`📡 Worker ${workerId}: Estabelecendo sessão...`);
                await page.goto(`https://www.farmrio.com.br`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (e) {
                console.log(`⚠️ Worker ${workerId}: Erro ao estabelecer sessão (Ignorando): ${e.message}`);
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
                        // Tenta múltiplas APIs para encontrar o produto
                        const apiQueries = [
                            `ft=${id}`,
                            `fq=alternativeId_RefId:${id}`,
                            `fq=productId:${id}`
                        ];

                        let productData = null;
                        for (const query of apiQueries) {
                            try {
                                const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?${query}`;
                                const response = await page.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                                let json = [];
                                try {
                                    json = await response.json();
                                } catch (e) {
                                    const text = await page.evaluate(() => document.body.innerText);
                                    try { json = JSON.parse(text); } catch (e2) { }
                                }

                                if (json && json.length > 0) {
                                    productData = json[0];
                                    console.log(`      ✅ [API] ID ${id} encontrado via ${query.split('=')[0]}`);
                                    break;
                                }
                            } catch (apiErr) {
                                // Silently try next query if 400 or timeout
                            }
                        }

                        // Check if JSON exists and has items
                        if (!productData) {
                            console.log(`      ⚠️ [Worker ${workerId}] ID ${id} não encontrado em nenhuma API.`);
                            itemNotFound = true;
                            continue;
                        }

                        // --- OPTIMIZATION: FAST PARSE FROM API ---
                        const fastProduct = fastParseFromApi(productData, item.isFavorito);

                        // If fastProduct has an error (like OOS or forbidden category), we can skip it entirely
                        if (fastProduct && fastProduct.error) {
                            console.log(`      ❌ [FastAPI] Descartado: ${fastProduct.error}`);
                            // If it's a "known" error like OOS, we don't treat it as a hard error for stats
                            if (fastProduct.error.includes('ESGOTADO') || fastProduct.error.includes('bloqueado')) {
                                itemNotFound = true;
                            } else {
                                itemHasError = true;
                            }
                            continue;
                        }

                        // If fastProduct is valid and complete, we use it and skip navigation!
                        if (fastProduct && fastProduct.data) {
                            console.log(`      ✅ [FastAPI] Capturado via API (Otimizado)`);
                            mergedProducts.push({ ...fastProduct.data, url: productData.link });
                            continue;
                        }

                        // Fallback to DOM parsing if fastParse was inconclusive but didn't error out
                        const productLink = productData.link;
                        if (!productLink) {
                            console.error(`      ❌ [Worker ${workerId}] Link não encontrado no JSON.`);
                            itemHasError = true;
                            continue;
                        }

                        await page.goto(productLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        const product = await parseProduct(page, page.url());

                        if (product) {
                            product.bazar = !!item.bazar;
                            product.isBazar = !!item.bazar;
                            product.bazarFavorito = !!item.bazarFavorito;
                            mergedProducts.push(product);
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

                    // REGRA ESTRITA: Bazar vem UNICAMENTE do que está no Drive (BAZAR no nome da foto)
                    finalProduct.bazar = !!item.bazar;
                    finalProduct.isBazar = !!item.bazar;
                    finalProduct.bazarFavorito = !!item.bazarFavorito;

                    finalProduct.url = appendQueryParams(finalProduct.url, { utm_campaign: "7B1313" });
                    finalProduct.loja = 'farm';
                    if (item.driveId) finalProduct.id = item.driveId; // Use verbatim Drive ID (e.g. 355028)
                    else finalProduct.id = finalProduct.id; // Keep original if no driveId

                    const isDup = isDuplicate(finalProduct.id, {
                        force: item.isFavorito,
                        maxAgeHours: options.maxAgeHours !== undefined ? options.maxAgeHours : 24
                    }, finalProduct.preco);

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
/**
 * Otimização: Extração de dados diretamente da API VTEX
 * Evita navegação desnecessária se os dados da API forem conclusivos.
 */
function fastParseFromApi(productData, isFavorito = false) {
    if (!productData) return { error: 'Dados da API vazios' };

    const name = productData.productName || '';
    const urlLower = String(productData.link || '').toLowerCase();
    const nameLower = name.toLowerCase();

    if (!name || !urlLower) {
        return { error: 'Nome ou Link ausente na API' };
    }

    // 1. FILTRO ANTI-INFANTIL (Fábula / Bento / Teen / Mini / Kids)
    if (/fabula|bento|teen|kids|infantil|brincando/i.test(urlLower) || /bento|fábula|fabula/i.test(nameLower)) {
        return { error: 'Produto Infantil detectado' };
    }

    // 2. CHECK BAZAR (Removed - strictly from Drive filenames now)
    const isBazar = false;

    // 3. CATEGORIA
    let category = 'desconhecido';
    const categories = productData.categories || [];
    const breadcrumbText = categories.join(' ').toLowerCase();
    const strictText = (urlLower + ' ' + nameLower + ' ' + breadcrumbText);

    if (strictText.includes('/vestido') || strictText.includes('vestido')) category = 'vestido';
    else if (strictText.includes('/macacao') || strictText.includes('/macaquinho') || strictText.includes('macacão') || strictText.includes('macaquinho')) category = 'macacão';
    else if (strictText.includes('/conjunto') || strictText.includes('conjunto')) category = 'conjunto';
    else if (strictText.includes('/saia') || strictText.includes('saia')) category = 'saia';
    else if (strictText.includes('/short') || strictText.includes('short')) category = 'short';
    else if (strictText.includes('/calca') || strictText.includes('calça')) category = 'calça';
    else if (strictText.includes('/blusa') || strictText.includes('/camisa') || strictText.includes('/t-shirt') || strictText.includes('blusa') || strictText.includes('camisa') || strictText.includes('t-shirt')) category = 'blusa';
    else if (strictText.includes('/casaco') || strictText.includes('/jaqueta') || strictText.includes('/moletom') || strictText.includes('casaco') || strictText.includes('jaqueta') || strictText.includes('moletom')) category = 'casaco';
    else if (strictText.includes('/body') || strictText.includes('/kimono') || strictText.includes('/top') || strictText.includes('body') || strictText.includes('kimono') || strictText.includes('top')) category = 'top/body';
    else if (strictText.includes('/biquini') || strictText.includes('/maio') || strictText.includes('biquíni') || strictText.includes('maiô') || strictText.includes('biquini') || strictText.includes('maio')) category = 'banho';

    if (category === 'desconhecido') {
        const isForbidden = (function () {
            if (/\/mala(-|\/)/i.test(strictText) || /\bmala\b/i.test(strictText)) return 'mala';
            if (/mochila/i.test(strictText) || /rodinha/i.test(strictText)) return 'mala';
            if (/\/brinco-/i.test(strictText) || /\/bolsa(-|\/|\?)/i.test(strictText) || /\bbolsa\b/i.test(strictText) || /\/colar-/i.test(strictText) || /\/cinto-/i.test(strictText)) return 'acessório';
            if (/\/garrafa-/i.test(strictText) || /\/copo-/i.test(strictText)) return 'utilitário';
            return null;
        })();
        if (isForbidden) return { error: `${isForbidden} bloqueado` };

        // Se for do Drive (Favorito ou Novidade), permitimos "desconhecido"
        // O fato de estar no Drive já é validação o suficiente.
        category = 'outro';
    }

    // 4. PREÇOS E DISPONIBILIDADE
    let precoOriginal = null;
    let precoAtual = null;
    const items = productData.items || [];
    const validSizes = [];

    items.forEach(item => {
        const seller = item.sellers && item.sellers[0];
        if (!seller || !seller.commertialOffer) return;

        const offer = seller.commertialOffer;
        // Se houver qualquer SKU disponível, pegamos o preço
        if (offer.AvailableQuantity > 0) {
            let size = item.name.toUpperCase().trim();
            // Suporte para "Cor - Tamanho"
            if (size.includes(' - ')) {
                const parts = size.split(' - ');
                size = parts[parts.length - 1].trim();
            }

            // Filtro de tamanho adulto
            if (/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i.test(size)) {
                validSizes.push(size);
                if (!precoAtual || offer.Price < precoAtual) precoAtual = offer.Price;
                if (!precoOriginal || offer.ListPrice > precoOriginal) precoOriginal = offer.ListPrice;
            }
        }
    });

    if (validSizes.length === 0) {
        return { error: `Produto ESGOTADO (Sem tamanhos disponíveis para ${category})` };
    }

    // 🚫 VALIDAÇÃO: Rejeitar roupas que só têm PP ou só têm GG (se houver PP+GG é válido)
    const clothingCategoriesForFilter = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'calça', 'macaquinho', 'conjunto', 'top/body', 'banho'];
    if (clothingCategoriesForFilter.includes(category)) {
        const uniqueSizes = [...new Set(validSizes.map(s => s.toUpperCase().trim()))];
        const isOnlyPP = uniqueSizes.length === 1 && uniqueSizes[0] === 'PP';
        const isOnlyGG = uniqueSizes.length === 1 && uniqueSizes[0] === 'GG';

        if (isOnlyPP || isOnlyGG) {
            return { error: `Apenas um tamanho extremo disponível (${uniqueSizes.join(', ')}) - necessário mais opções` };
        }
    }

    // Se não houver preço original no JSON, assume o atual
    if (!precoOriginal) precoOriginal = precoAtual;

    // --- REGRA DE DESCONTO (Sincronizada com parser.js) ---
    // Nota: Aqui não temos acesso à constante FARM_TEMP_DISCOUNT_RULE do parser.js
    // mas o orchestrator costuma lidar com isso ou o parser.js é chamado como fallback.
    // Para ser seguro, se o desconto for complexo, deixamos o parseProduct do parser.js agir.
    // Mas vamos aplicar a regra de 10% de roupas sem promo se for o caso.

    const clothingCategories = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'calça', 'macaquinho'];
    if (precoOriginal === precoAtual && clothingCategories.includes(category)) {
        precoAtual = parseFloat((precoAtual * 0.90).toFixed(2));
    }

    return {
        data: {
            id: productData.productReference || productData.productId,
            nome: name,
            precoOriginal: precoOriginal,
            precoAtual: precoAtual,
            tamanhos: [...new Set(validSizes)],
            categoria: category,
            bazar: false, // Default to false, will be overridden by Drive metadata if available
            imageUrl: items[0]?.images[0]?.imageUrl || null
        }
    };
}

module.exports = { scrapeSpecificIds };
