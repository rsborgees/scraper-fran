/**
 * ID Scanner Genérico - Busca produtos por ID para todas as lojas
 * Usado pelo Drive-First para buscar produtos específicos
 */
const { normalizeId, isDuplicate, markAsSent } = require('../historyManager');

// Parsers de cada loja
const { parseProductDressTo } = require('./dressto');
const { parseProductKJU } = require('./kju');
const { parseProductZZMall } = require('./zzmall');
const { parseProductLive } = require('./live');

const { scrapeLiveByName } = require('./live/nameScanner');
const { processImageDirect } = require('../imageDownloader');

// Configurações por loja
const STORE_CONFIG = {
    dressto: {
        baseUrl: 'https://www.dressto.com.br',
        directUrlBuilder: (id) => `https://www.dressto.com.br/${id}?_q=${id}&map=ft&sc=1`,
        searchUrl: (id) => `https://www.dressto.com.br/${id}?_q=${id}&map=ft&sc=1`,
        searchInputSelector: 'input[type="search"], input[placeholder*="Buscar"], .vtex-store-components-3-x-searchBarIcon',
        productLinkSelector: 'a.vtex-product-summary-2-x-clearLink, a[href*="/p"], .vtex-product-summary-2-x-image',
        parser: 'dressto',
        utmParam: null
    },
    kju: {
        baseUrl: 'https://www.kjubrasil.com',
        directUrlBuilder: null,
        searchUrl: (id) => `https://www.kjubrasil.com/busca/?q=${id}`,
        searchInputSelector: 'input[name="q"], input.search',
        productLinkSelector: '.produtos .item a, .prod a, a.b_acao, .product-item a, a.product-link, div[class*="product"] a[href*="/produto/"], div[class*="product"] a[href*="/p/"]',
        parser: 'kju',
        utmParam: 'ref=7B1313'
    },
    zzmall: {
        baseUrl: 'https://www.zzmall.com.br',
        directUrlBuilder: (id) => `https://www.zzmall.com.br/search/${id}`,
        searchUrl: (id) => `https://www.zzmall.com.br/search/${id}`,
        searchInputSelector: 'input[type="search"], .vtex-store-components-3-x-searchBarIcon',
        productLinkSelector: 'a[href*="/p/"], a.vtex-product-summary-2-x-clearLink',
        parser: 'zzmall',
        utmParam: 'influ=cupomdafran'
    },
    live: {
        baseUrl: 'https://www.liveoficial.com.br',
        directUrlBuilder: (id) => `https://www.liveoficial.com.br/${id}?map=ft`,
        searchUrl: (id) => `https://www.liveoficial.com.br/${id}?map=ft`,
        searchInputSelector: 'input.bn-search__input, input[type="search"], .search-input',
        productLinkSelector: 'a[href$="/p"], a.vtex-product-summary-2-x-clearLink',
        parser: 'live',
        utmParam: null
    }
};

/**
 * Scraper focado em IDs específicos para múltiplas lojas (Drive-First)
 */
async function scrapeSpecificIdsGeneric(contextOrBrowser, driveItems, storeName, quota = 999, options = {}) {
    const maxAgeHours = options.maxAgeHours || 48;
    const config = STORE_CONFIG[storeName];
    if (!config) {
        console.log(`❌ [ID Scanner] Loja não configurada: ${storeName}`);
        return { products: [], attemptedIds: [], stats: { found: 0, errors: 0 } };
    }

    console.log(`\n🔍 [${storeName.toUpperCase()}] DRIVE-FIRST: Processando ${driveItems.length} candidatos (Meta: ${quota})...`);

    const collectedProducts = [];
    const attemptedIds = [];
    const stats = {
        total: driveItems.length,
        checked: 0,
        found: 0,
        duplicates: 0,
        notFound: 0,
        errors: 0
    };

    const nameBasedItems = driveItems.filter(i => i.searchByName);
    const idBasedItems = driveItems.filter(i => !i.searchByName);

    if (idBasedItems.length > 0) {
        const page = await contextOrBrowser.newPage({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale: 'pt-BR'
        });

        if (storeName === 'dressto') {
            await contextOrBrowser.addCookies([
                { name: 'vtex_segment', value: 'eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9', domain: '.dressto.com.br', path: '/' }
            ]).catch(() => { });
        }

        try {
            for (const item of idBasedItems) {
                if (collectedProducts.length >= quota) break;

                stats.checked++;
                const finalIdCandidate = item.driveId || item.id;
                attemptedIds.push(finalIdCandidate);
                console.log(`\n🔍 [${storeName}] Buscando ID ${finalIdCandidate} (${item.isFavorito ? '⭐ Favorito' : 'Regular'})...`);

                const normIdCheck = normalizeId(finalIdCandidate);
                if (!item.isFavorito && isDuplicate(normIdCheck, { maxAgeHours })) {
                    console.log(`   ⏭️  Pulando: Já enviado recentemente.`);
                    stats.duplicates++;
                    continue;
                }

                try {
                    let navigationSuccess = false;
                    let productData = null;

                    // 👗 DRESS TO STRATEGY: API-FIRST -> BROWSER FALLBACK
                    if (storeName === 'dressto') {
                        try {
                            const pApi = require('./dressto/parser');
                            console.log(`      🔄 [DRESSTO] Usando API Direta para ID ${item.id}...`);
                            productData = await pApi.fetchViaVtexAPI(item.id);

                            if (productData) {
                                console.log(`      ✅ [DRESSTO] Sucesso via API! (${productData.nome})`);
                                navigationSuccess = true;
                            } else {
                                console.log(`      ⚠️ [DRESSTO] API falhou. Tentando Browser...`);
                                await page.goto('https://www.dressto.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });

                                const variations = [item.id, item.id.replace(/_/g, '-'), item.id.replace(/_/g, '')];
                                for (const v of variations) {
                                    if (navigationSuccess) break;
                                    const searchUrl = `https://www.dressto.com.br/${v}?_q=${v}&map=ft&sc=1`;
                                    console.log(`      🔄 Tentando Browser: ${searchUrl}`);
                                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                    await page.waitForTimeout(4000);

                                    if (page.url().includes('/p')) {
                                        navigationSuccess = true;
                                    } else {
                                        const productLink = await page.$('a[class*="vtex-product-summary-2-x-clearLink"], a[href*="/p"]');
                                        if (productLink) {
                                            await productLink.click();
                                            await page.waitForTimeout(5000);
                                            if (page.url().includes('/p')) navigationSuccess = true;
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            console.log(`      ❌ Erro na estratégia DressTo: ${err.message}`);
                        }
                    }

                    // Fallback para Outras Lojas ou se DressTo falhou
                    if (!navigationSuccess && config.directUrlBuilder) {
                        const directUrl = config.directUrlBuilder(item.id);
                        try {
                            await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                            navigationSuccess = true;
                            await page.waitForTimeout(1500);
                        } catch (e) {
                            console.log(`      ⚠️ Falha na Direct URL: ${e.message}`);
                        }
                    }

                    if (!navigationSuccess) {
                        const searchUrl = config.searchUrl(item.id);
                        try {
                            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                            navigationSuccess = true;
                            await page.waitForTimeout(2500);
                        } catch (e) {
                            console.log(`      ⚠️ Falha na Search URL: ${e.message}`);
                        }
                    }

                    // Detection and Parse
                    let product = productData;
                    const finalUrl = page.url();

                    if (!product && navigationSuccess) {
                        let isProductPage = finalUrl.includes('/p') || finalUrl.includes('/produto');
                        if (!isProductPage) {
                            isProductPage = await page.evaluate(() => {
                                return !!document.querySelector('.codigo_produto, .productReference, .vtex-product-identifier');
                            });
                        }

                        if (!isProductPage) {
                            const notFound = await page.evaluate(() => {
                                const text = document.body.innerText || '';
                                return text.includes('Nenhum produto foi encontrado') || text.includes('NÃO ENCONTRAMOS O QUE VOCÊ BUSCOU');
                            });

                            if (notFound) {
                                console.log(`   ❌ Produto ${item.id} não disponível.`);
                                stats.notFound++;
                                continue;
                            }

                            const selector = config.productLinkSelector || 'a[href*="/p"]';
                            const href = await page.evaluate((sel) => {
                                const a = document.querySelector(sel);
                                return a ? a.href : null;
                            }, selector);

                            if (href) {
                                await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                await page.waitForTimeout(1500);
                            } else {
                                console.log(`   ❌ Produto ${item.id} não encontrado na listagem.`);
                                stats.notFound++;
                                continue;
                            }
                        }

                        // Final Parse
                        if (storeName === 'dressto') product = await parseProductDressTo(page, page.url());
                        else if (storeName === 'kju') product = await parseProductKJU(page, page.url());
                        else if (storeName === 'live') product = await parseProductLive(page, page.url());
                        else if (storeName === 'zzmall') product = await parseProductZZMall(page, page.url());
                    }

                    if (product) {
                        product.imagePath = item.driveUrl || product.imagePath;
                        product.imageUrl = item.driveUrl || product.imageUrl;

                        if (storeName === 'dressto' && !product.imageUrl) {
                            console.log(`   🛑 [DRESSTO] Bloqueando item sem imagem no Drive.`);
                            continue;
                        }

                        product.favorito = !!item.isFavorito;
                        product.novidade = !!item.novidade;
                        product.loja = storeName;
                        product.id = item.driveId || product.id || item.id;

                        collectedProducts.push(product);
                        console.log(`   ✅ [${storeName}] Capturado: ${product.nome}`);
                        stats.found++;
                        if (!item.isFavorito) markAsSent([product.id]);
                    } else {
                        console.log(`   ❌ Falha ao capturar dados do produto ${item.id}`);
                        stats.errors++;
                    }

                } catch (err) {
                    console.error(`   ❌ Erro no ID ${item.id}: ${err.message}`);
                    stats.errors++;
                }
                await page.waitForTimeout(1000);
            }
        } catch (globalErr) {
            console.error(`❌ Erro crítico no ID Scanner ${storeName}:`, globalErr.message);
        } finally {
            await page.close();
        }
    }

    if (storeName === 'live' && nameBasedItems.length > 0) {
        const remainingQuota = quota - collectedProducts.length;
        if (remainingQuota > 0) {
            try {
                const nameProducts = await scrapeLiveByName(contextOrBrowser, nameBasedItems, remainingQuota);
                collectedProducts.push(...nameProducts);
                stats.found += nameProducts.length;
            } catch (e) {
                console.error(`❌ Erro no scrapeLiveByName: ${e.message}`);
            }
        }
    }

    return { products: collectedProducts, attemptedIds, stats };
}

module.exports = { scrapeSpecificIdsGeneric, STORE_CONFIG };
