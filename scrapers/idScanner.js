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
        const CONCURRENCY_LIMIT = 5;
        const itemQueue = [...idBasedItems];
        let isQuotaReached = false;

        const worker = async (workerId) => {
            let page;
            let ownsPage = false;

            if (typeof contextOrBrowser.newPage === 'function') {
                page = await contextOrBrowser.newPage({
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    locale: 'pt-BR'
                });
                ownsPage = true;
            } else {
                page = contextOrBrowser;
            }

            if (storeName === 'zzmall') {
                await page.route('**/*', (route) => {
                    const url = route.request().url().toLowerCase();
                    if (url.includes('novidades') || url.includes('fallback') || url.includes('transparencia')) {
                        return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Destino Bloqueado</body></html>' });
                    }
                    return route.continue();
                });
            }

            if (storeName === 'dressto' && ownsPage) {
                await contextOrBrowser.addCookies([
                    { name: 'vtex_segment', value: 'eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9', domain: '.dressto.com.br', path: '/' }
                ]).catch(() => { });
            }

            try {
                while (itemQueue.length > 0 && !isQuotaReached) {
                    if (collectedProducts.length >= quota) {
                        isQuotaReached = true;
                        break;
                    }

                    const item = itemQueue.shift();
                    if (!item) break;

                    stats.checked++;
                    const finalIdCandidate = item.driveId || item.id;
                    attemptedIds.push(finalIdCandidate);
                    console.log(`\n🔍 [${storeName.toUpperCase()}-W${workerId}] Buscando ID ${finalIdCandidate} (${item.isFavorito ? '⭐ Favorito' : 'Regular'})...`);

                    const normIdCheck = normalizeId(finalIdCandidate);
                    if (!item.isFavorito && isDuplicate(normIdCheck, { maxAgeHours })) {
                        console.log(`   ⏭️  [W${workerId}] Pulando: Já enviado recentemente.`);
                        stats.duplicates++;
                        continue;
                    }

                    try {
                        let navigationSuccess = false;
                        let productData = null;

                        if (storeName === 'dressto') {
                            try {
                                const pApi = require('./dressto/parser');
                                console.log(`      🔄 [DRESSTO-W${workerId}] Usando API Direta para ID ${item.id}...`);
                                productData = await pApi.fetchViaVtexAPI(item.id);

                                if (productData) {
                                    console.log(`      ✅ [DRESSTO-W${workerId}] Sucesso via API! (${productData.nome})`);
                                    navigationSuccess = true;
                                } else {
                                    console.log(`      ⚠️ [DRESSTO-W${workerId}] API falhou. Tentando Browser...`);
                                    await page.goto('https://www.dressto.com.br/', { waitUntil: 'load', timeout: 30000 });

                                    const prefix = item.id.split('_')[0];
                                    const variations = [item.id, item.id.replace(/_/g, '-'), item.id.replace(/_/g, ''), prefix];
                                    for (const v of variations) {
                                        if (navigationSuccess) break;
                                        const searchUrl = `https://www.dressto.com.br/${v}?_q=${v}&map=ft&sc=1`;
                                        console.log(`      🔄 [W${workerId}] Tentando Browser: ${searchUrl}`);
                                        await page.goto(searchUrl, { waitUntil: 'load', timeout: 30000 });
                                        await page.waitForTimeout(4000);

                                        if (page.url().includes('/p')) {
                                            navigationSuccess = true;
                                        } else {
                                            const productLink = await page.$('a[class*="vtex-product-summary-2-x-clearLink"], a[href*="/p"]');
                                            if (productLink) {
                                                await productLink.evaluate(el => el.click());
                                                await page.waitForTimeout(5000);
                                                if (page.url().includes('/p')) navigationSuccess = true;
                                            }
                                        }
                                    }
                                }
                            } catch (err) {
                                console.log(`      ❌ [DRESSTO-W${workerId}] Erro na estratégia DressTo: ${err.message}`);
                            }
                        }

                        if (!navigationSuccess && config.directUrlBuilder) {
                            const directUrl = config.directUrlBuilder(item.id);
                            try {
                                await page.goto(directUrl, { waitUntil: 'load', timeout: 30000 });
                                navigationSuccess = true;
                                await page.waitForTimeout(1500);
                            } catch (e) {
                                console.log(`      ⚠️ [W${workerId}] Falha na Direct URL: ${e.message}`);
                            }
                        }

                        if (!navigationSuccess) {
                            const searchUrl = config.searchUrl(item.id);
                            try {
                                await page.goto(searchUrl, { waitUntil: 'load', timeout: 30000 });
                                navigationSuccess = true;
                                await page.waitForTimeout(2500);
                            } catch (e) {
                                console.log(`      ⚠️ [W${workerId}] Falha na Search URL: ${e.message}`);
                            }
                        }

                        let product = productData;
                        if (product) {
                            product.imagePath = item.driveUrl || product.imagePath;
                            product.imageUrl = item.driveUrl || product.imageUrl;

                            if (storeName === 'dressto' && !product.imageUrl) {
                                console.log(`   🛑 [DRESSTO-W${workerId}] Bloqueando item sem imagem no Drive.`);
                                continue;
                            }

                            product.favorito = !!item.isFavorito;
                            product.novidade = !!item.novidade;
                            product.bazar = !!item.bazar;
                            product.isBazar = product.bazar;
                            product.bazarFavorito = !!item.bazarFavorito;
                            product.verao = !!item.verao;
                            product.altoVerao = !!item.altoVerao;
                            product.inverno = !!item.inverno;
                            product.altoInverno = !!item.altoInverno;
                            product.loja = storeName;
                            product.id = item.driveId || product.id || item.id;

                            collectedProducts.push(product);
                            console.log(`   ✅ [${storeName.toUpperCase()}-W${workerId}] Capturado: ${product.nome}`);
                            stats.found++;
                            if (!item.isFavorito) markAsSent([product.id]);
                        } else if (navigationSuccess) {
                            if (storeName === 'zzmall') {
                                let isPaginaValida = false;
                                page.on('console', msg => {
                                    const text = msg.text();
                                    const isNoisyNetworkError = text.includes('Failed to load resource: net::') || 
                                                                text.includes('the server responded with a status of 404') || 
                                                                text.includes('Attestation check for Attribution Reporting');
                                    
                                    if ((msg.type() === 'error' && !isNoisyNetworkError) || text.includes('[IDSCANNER]')) {
                                        console.log(`      🖥️ [BROWSER-W${workerId}] ${text}`);
                                    }
                                });

                                try {
                                    await page.goto('https://www.zzmall.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
                                    await page.waitForTimeout(2000);
                                    try {
                                        const cookieBtn = await page.$('#onesignal-slidedown-cancel-button, button:has-text("Aceitar"), .cookie-accept-button');
                                        if (cookieBtn) {
                                            console.log(`      🍪 [ZZMALL-W${workerId}] Aceitando cookies/notificações...`);
                                            await cookieBtn.click();
                                        }
                                    } catch (e) { }
                                    await page.mouse.wheel(0, 300);
                                    await page.waitForTimeout(3000);
                                } catch (e) {
                                    console.log(`      ⚠️ [ZZMALL-W${workerId}] Falha no warmup: ${e.message}`);
                                }

                                console.log(`      🔎 [ZZMALL-W${workerId}] Tentando API de busca direta para ID ${item.id}...`);
                                try {
                                    const apiUrl = `https://www.zzmall.com.br/arezzocoocc/v2/marketplacezz/products/search?query=${item.id}&fields=FULL`;
                                    const targetId = item.id;

                                    const productUrl = await page.evaluate(async ({ url, id }) => {
                                        try {
                                            const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'include' });
                                            if (resp.ok) {
                                                const data = await resp.json();
                                                const count = data.products ? data.products.length : 0;
                                                if (count > 0) {
                                                    const match = data.products.find(p => (p.code && p.code.includes(id)) || (p.url && p.url.includes(id)) || (p.legacySKU && p.legacySKU.includes(id)));
                                                    return match ? match.url : null;
                                                }
                                            }
                                        } catch (e) {}
                                        return null;
                                    }, { url: apiUrl, id: targetId });

                                    if (productUrl) {
                                        const finalUrl = `https://www.zzmall.com.br${productUrl}`;
                                        console.log(`      🚀 [ZZMALL-W${workerId}] API encontrou URL: ${finalUrl}. Navegando...`);
                                        await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                        await page.waitForTimeout(5000);
                                        const checkNow = page.url();
                                        isPaginaValida = checkNow.includes('/p') || checkNow.includes('/produto');
                                    }
                                } catch (err) {
                                }

                                if (!isPaginaValida) {
                                    const searchUrl = config.searchUrl(item.id);
                                    try {
                                        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                        console.log(`      ⏳ [ZZMALL-W${workerId}] Esperando 10s para busca...`);
                                        await page.waitForTimeout(10000);
                                        const urlCheck = page.url();
                                        isPaginaValida = urlCheck.includes('/p') || urlCheck.includes('/produto') || urlCheck.includes('/search/');
                                    } catch (e) {}
                                }

                                if (!isPaginaValida) {
                                    console.log(`      ⚠️ [ZZMALL-W${workerId}] API falhou. Iniciando fluxo HUMAN-LIKE...`);
                                    try {
                                        await page.goto('https://www.zzmall.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
                                        await page.waitForTimeout(2000 + Math.random() * 3000);
                                        const searchInput = await page.$('input.inner-input[placeholder="Buscar"]');
                                        if (searchInput) {
                                            const box = await searchInput.boundingBox();
                                            if (box) {
                                                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
                                                await page.mouse.down();
                                                await page.mouse.up();
                                            } else {
                                                await searchInput.click();
                                            }
                                            await page.waitForTimeout(500 + Math.random() * 500);
                                            await page.keyboard.down('Control');
                                            await page.keyboard.press('A');
                                            await page.keyboard.up('Control');
                                            await page.keyboard.press('Backspace');
                                            for (const char of item.id) {
                                                await page.keyboard.type(char, { delay: 100 + Math.random() * 200 });
                                            }

                                            console.log(`      ⏳ [ZZMALL-W${workerId}] Aguardando overlay...`);
                                            const overlaySelector = '.search-results__products__item__link, a[href*="/p/"]';
                                            try {
                                                await page.waitForSelector(overlaySelector, { timeout: 15000 });
                                                await page.waitForTimeout(1500);
                                                const results = await page.$$(overlaySelector);
                                                let clicked = false;
                                                for (const res of results) {
                                                    const href = await res.getAttribute('href');
                                                    const text = await res.innerText();
                                                    if (href && (href.includes(item.id) || href.toLowerCase().includes(item.id.toLowerCase()))) {
                                                        await res.click();
                                                        clicked = true;
                                                        break;
                                                    }
                                                    if (text && text.includes(item.id)) {
                                                        await res.click();
                                                        clicked = true;
                                                        break;
                                                    }
                                                }
                                                if (clicked) await page.waitForTimeout(6000);
                                            } catch (err) {
                                                await page.keyboard.press('Enter');
                                                await page.waitForTimeout(10000);
                                            }
                                        }
                                    } catch (e) {}
                                }
                            }

                            let finalPageUrl = page.url();
                            let isProductPage = finalPageUrl.includes('/p') || finalPageUrl.includes('/produto');

                            if (!isProductPage) {
                                const isLikelySearch = finalPageUrl.includes('/search/') || finalPageUrl.includes('/busca/') || finalPageUrl.includes('_q=') || finalPageUrl.includes('map=ft') || finalPageUrl.toLowerCase().includes(item.id.toLowerCase());
                                if (isLikelySearch) {
                                    console.log(`      🖱️ [${storeName.toUpperCase()}-W${workerId}] Tentando clicar no ID ${item.id}...`);
                                    const selector = config.productLinkSelector || 'a[href*="/p/"], a[href*="/produto/"]';
                                    const itemFound = await page.evaluate(({ sel, targetId }) => {
                                        const anchors = Array.from(document.querySelectorAll(sel));
                                        const bestMatch = anchors.find(a => a.href.toLowerCase().includes(targetId.toLowerCase()));
                                        const a = bestMatch || anchors[0];
                                        if (a) {
                                            a.click();
                                            return true;
                                        }
                                        return false;
                                    }, { sel: selector, targetId: item.id });
                                    if (itemFound) {
                                        await page.waitForTimeout(5000);
                                        finalPageUrl = page.url();
                                        isProductPage = finalPageUrl.includes('/p') || finalPageUrl.includes('/produto');
                                    }
                                }
                            }

                            if (!isProductPage) {
                                isProductPage = await page.evaluate(() => {
                                    return !!document.querySelector('.codigo_produto, .productReference, .vtex-product-identifier');
                                });
                            }

                            if (!isProductPage) {
                                const notFound = await page.evaluate(() => {
                                    if (!document.body) return false;
                                    const text = document.body.innerText || '';
                                    return text.includes('Nenhum produto foi encontrado') || text.includes('NÃO ENCONTRAMOS O QUE VOCÊ BUSCOU');
                                });

                                if (notFound) {
                                    console.log(`   ❌ [W${workerId}] Produto ${item.id} não disponível.`);
                                    stats.notFound++;
                                    continue;
                                }

                                const selector = config.productLinkSelector || 'a[href*="/p"]';
                                const href = await page.evaluate((sel) => {
                                    const a = document.querySelector(sel);
                                    return a ? a.href : null;
                                }, selector);

                                const currentUrlBeforeHref = page.url();
                                const isLikelySearch = currentUrlBeforeHref.includes('/search/') || currentUrlBeforeHref.includes('/busca/') || currentUrlBeforeHref.includes('_q=') || currentUrlBeforeHref.includes('map=ft');

                                if (!currentUrlBeforeHref.includes('/p') && !currentUrlBeforeHref.includes('/produto') && !isLikelySearch) {
                                    console.log(`   ❌ [${storeName.toUpperCase()}-W${workerId}] Abortando: Landing page inválida.`);
                                    continue;
                                }
                            }

                            if (storeName === 'zzmall') {
                                const pageId = await page.evaluate(() => {
                                    const refEl = document.querySelector('.vtex-product-identifier, .productReference');
                                    if (!refEl) return '';
                                    return (refEl.innerText || '').trim();
                                });

                                if (pageId && !pageId.toLowerCase().includes(item.id.toLowerCase()) && !item.id.toLowerCase().includes(pageId.toLowerCase())) {
                                    console.log(`   ❌ [ZZMALL-W${workerId}] ID Errado na página: Encontrou ${pageId} mas queria ${item.id}.`);
                                    continue;
                                }
                            }

                            if (storeName === 'dressto') product = await parseProductDressTo(page, page.url());
                            else if (storeName === 'kju') product = await parseProductKJU(page, page.url());
                            else if (storeName === 'live') product = await parseProductLive(page, page.url());
                            else if (storeName === 'zzmall') product = await parseProductZZMall(page, page.url());

                            if (product) {
                                product.loja = storeName;
                                product.brand = storeName === 'dressto' ? 'DRESS' : storeName.toUpperCase();
                                product.favorito = !!item.isFavorito;
                                product.novidade = !!item.novidade;
                                product.bazar = !!item.bazar;
                                product.isBazar = product.bazar;
                                product.bazarFavorito = !!item.bazarFavorito;
                                product.verao = !!item.verao;
                                product.altoVerao = !!item.altoVerao;
                                product.inverno = !!item.inverno;
                                product.altoInverno = !!item.altoInverno;
                                product.driveSize = item.driveSize || null;

                                const driveId = item.driveId || item.id;
                                if (driveId) {
                                    product.id = driveId;
                                } else {
                                    product.id = product.id || item.id;
                                }

                                if (item.driveUrl) {
                                    product.imagePath = item.driveUrl;
                                    product.imageUrl = item.driveUrl;
                                }

                                collectedProducts.push(product);
                                stats.found++;
                                if (collectedProducts.length >= quota) {
                                    isQuotaReached = true;
                                    break;
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`   ❌ [W${workerId}] Erro no ID ${item.id}: ${err.message}`);
                        stats.errors++;
                    }
                    await page.waitForTimeout(1000);
                }
            } catch (globalErr) {
                console.error(`❌ Erro crítico no Worker ${workerId} ${storeName}:`, globalErr.message);
            } finally {
                if (ownsPage && typeof page.close === 'function') await page.close();
            }
        };

        console.log(`🚀 Iniciando ${Math.min(idBasedItems.length, CONCURRENCY_LIMIT)} workers simultâneos (Generic-${storeName})...`);
        const workers = [];
        for (let i = 0; i < Math.min(idBasedItems.length, CONCURRENCY_LIMIT); i++) {
            workers.push(worker(i + 1));
        }

        await Promise.all(workers);
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
