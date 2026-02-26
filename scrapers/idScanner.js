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
        let page;
        let ownsPage = false;

        if (typeof contextOrBrowser.newPage === 'function') {
            page = await contextOrBrowser.newPage({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                locale: 'pt-BR'
            });

        } else {
            // It's already a page object
            page = contextOrBrowser;
        }

        // BLOQUEIO DE REDIRECIONAMENTO PROIBIDO
        if (storeName === 'zzmall') {
            await page.route('**/*', (route) => {
                const url = route.request().url().toLowerCase();
                // Bloqueio estrito de qualquer recurso ou navegação para caminhos proibidos
                if (url.includes('novidades') || url.includes('fallback') || url.includes('transparencia')) {
                    // Cumpriremos com uma página vazia para evitar erro de navegador (ERR_FAILED)
                    return route.fulfill({
                        status: 200,
                        contentType: 'text/html',
                        body: '<html><body>Destino Bloqueado</body></html>'
                    });
                }
                return route.continue();
            });
        }

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
                    } else if (navigationSuccess) {
                        // SPECIAL HANDLING FOR ZZMALL: Explicit search -> wait -> click
                        if (storeName === 'zzmall') {
                            let isPaginaValida = false;

                            // 🛡️ CAPTURA LOGS DO CONSOLE (DEBUG)
                            page.on('console', msg => {
                                if (msg.type() === 'error' || msg.text().includes('[IDSCANNER]')) {
                                    console.log(`      🖥️ [BROWSER] ${msg.text()}`);
                                }
                            });

                            // 1. WARMUP: Vamos para a home primeiro para estabelecer a sessão
                            try {
                                await page.goto('https://www.zzmall.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
                                await page.waitForTimeout(2000);

                                // Tenta aceitar cookies para limpar o overlay
                                try {
                                    const cookieBtn = await page.$('#onesignal-slidedown-cancel-button, button:has-text("Aceitar"), .cookie-accept-button');
                                    if (cookieBtn) {
                                        console.log(`      🍪 [ZZMALL] Aceitando cookies/notificações...`);
                                        await cookieBtn.click();
                                    }
                                } catch (e) { }

                                // Pequeno scroll humano
                                await page.mouse.wheel(0, 300);
                                await page.waitForTimeout(3000);
                            } catch (e) {
                                console.log(`      ⚠️ [ZZMALL] Falha no warmup: ${e.message}`);
                            }

                            // 2. API DE BUSCA DIRETA (Tenta antes da navegação para ser mais limpo)
                            console.log(`      🔎 [ZZMALL] Tentando API de busca direta para ID ${item.id}...`);
                            try {
                                const apiUrl = `https://www.zzmall.com.br/arezzocoocc/v2/marketplacezz/products/search?query=${item.id}&fields=FULL`;
                                const targetId = item.id;

                                const productUrl = await page.evaluate(async ({ url, id }) => {
                                    try {
                                        const resp = await fetch(url, {
                                            headers: { 'Accept': 'application/json' },
                                            credentials: 'include'
                                        });
                                        console.log(`      [IDSCANNER] API Status: ${resp.status}`);
                                        if (resp.ok) {
                                            const data = await resp.json();
                                            const count = data.products ? data.products.length : 0;
                                            console.log(`      [IDSCANNER] API encontrou ${count} produtos.`);

                                            if (count > 0) {
                                                const ids = data.products.map(p => p.code).join(', ');
                                                console.log(`      [IDSCANNER] IDs na API: ${ids}`);

                                                const match = data.products.find(p =>
                                                    (p.code && p.code.includes(id)) ||
                                                    (p.url && p.url.includes(id)) ||
                                                    (p.legacySKU && p.legacySKU.includes(id))
                                                );
                                                return match ? match.url : null;
                                            } else {
                                                console.log(`      [IDSCANNER] API retornou array de produtos vazio.`);
                                            }
                                        }
                                    } catch (e) {
                                        console.log(`      [IDSCANNER] API Error: ${e.message}`);
                                    }
                                    return null;
                                }, { url: apiUrl, id: targetId });

                                if (productUrl) {
                                    const finalUrl = `https://www.zzmall.com.br${productUrl}`;
                                    console.log(`      🚀 [ZZMALL] API encontrou URL: ${finalUrl}. Navegando...`);
                                    await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                    await page.waitForTimeout(5000);
                                    const checkNow = page.url();
                                    isPaginaValida = checkNow.includes('/p') || checkNow.includes('/produto');
                                }
                            } catch (err) {
                                console.log(`      ⚠️ [ZZMALL] Erro ao consultar API de busca.`);
                            }

                            // 3. BUSCA DIRETA (Se a API falhar)
                            if (!isPaginaValida) {
                                const searchUrl = config.searchUrl(item.id);
                                try {
                                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                    console.log(`      ⏳ [ZZMALL] Esperando 10s para carregamento da busca...`);
                                    await page.waitForTimeout(10000);
                                    const urlCheck = page.url();
                                    isPaginaValida = urlCheck.includes('/p') || urlCheck.includes('/produto') || urlCheck.includes('/search/');
                                } catch (e) {
                                    console.log(`      ⚠️ [ZZMALL] Erro na navegação de busca.`);
                                }
                            }

                            // 4. FALLBACK 2: Se a API e a Busca falharem, tenta o fluxo HUMAN-LIKE no UI Overlay
                            if (!isPaginaValida) {
                                console.log(`      ⚠️ [ZZMALL] API falhou ou não encontrou. Iniciando fluxo HUMAN-LIKE...`);
                                try {
                                    await page.goto('https://www.zzmall.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
                                    // Delay humano para "ler" a home
                                    await page.waitForTimeout(2000 + Math.random() * 3000);

                                    const searchInput = await page.$('input.inner-input[placeholder="Buscar"]');
                                    if (searchInput) {
                                        // Simula movimento do mouse até o input
                                        const box = await searchInput.boundingBox();
                                        if (box) {
                                            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
                                            await page.mouse.down();
                                            await page.mouse.up();
                                        } else {
                                            await searchInput.click();
                                        }

                                        await page.waitForTimeout(500 + Math.random() * 500);

                                        // Limpa e foca
                                        await page.keyboard.down('Control');
                                        await page.keyboard.press('A');
                                        await page.keyboard.up('Control');
                                        await page.keyboard.press('Backspace');

                                        // Digita ID com delay variável por caractere
                                        for (const char of item.id) {
                                            await page.keyboard.type(char, { delay: 100 + Math.random() * 200 });
                                        }

                                        console.log(`      ⏳ [ZZMALL] Aguardando overlay de resultados...`);
                                        const overlaySelector = '.search-results__products__item__link, a[href*="/p/"]';

                                        try {
                                            // Espera o overlay aparecer
                                            await page.waitForSelector(overlaySelector, { timeout: 15000 });
                                            await page.waitForTimeout(1500); // Garante que renderizou tudo

                                            const results = await page.$$(overlaySelector);
                                            console.log(`      🔎 [ZZMALL] Overlay encontrou ${results.length} links.`);

                                            let clicked = false;
                                            for (const res of results) {
                                                const href = await res.getAttribute('href');
                                                const text = await res.innerText();

                                                // Validação super estrita do ID no HREF ou no TEXTO do item
                                                if (href && (href.includes(item.id) || href.toLowerCase().includes(item.id.toLowerCase()))) {
                                                    console.log(`      🖱️ [ZZMALL] Clicando no item EXATO via HREF...`);
                                                    await res.click();
                                                    clicked = true;
                                                    break;
                                                }
                                                if (text && text.includes(item.id)) {
                                                    console.log(`      🖱️ [ZZMALL] Clicando no item EXATO via TEXTO...`);
                                                    await res.click();
                                                    clicked = true;
                                                    break;
                                                }
                                            }

                                            if (clicked) await page.waitForTimeout(6000);

                                        } catch (err) {
                                            console.log(`      ⚠️ [ZZMALL] Overlay falhou. Tentando Enter como fallback final...`);
                                            await page.keyboard.press('Enter');
                                            await page.waitForTimeout(10000);
                                        }
                                    }
                                } catch (e) {
                                    console.log(`      ❌ [ZZMALL] Erro no fluxo human-like.`);
                                }
                            }

                            // Re-valida final
                            const finalCheckUrl = page.url();
                            const finalValida = finalCheckUrl.includes('/p') || finalCheckUrl.includes('/produto') || finalCheckUrl.includes('/search/');

                            if (!finalValida) {
                                console.log(`   ❌ [ZZMALL] BLOQUEADO: Destino inválido após todas as tentativas.`);
                                stats.notFound++;
                                continue;
                            }

                            const isProductPage = page.url().includes('/p') || page.url().includes('/produto');
                            if (!isProductPage) {
                                console.log(`      🖱️ [ZZMALL] Tentando clicar no item que corresponde ao ID ${item.id}...`);
                                const selector = config.productLinkSelector || 'a[href*="/p/"]';

                                const itemFound = await page.evaluate(({ sel, targetId }) => {
                                    const anchors = Array.from(document.querySelectorAll(sel));
                                    // Prioridade 1: Link que CONTÉM o ID exato no href
                                    const bestMatch = anchors.find(a => a.href.toLowerCase().includes(targetId.toLowerCase()));
                                    const a = bestMatch || anchors[0];
                                    if (a) {
                                        a.click();
                                        return true;
                                    }
                                    return false;
                                }, { sel: selector, targetId: item.id });

                                if (itemFound) {
                                    console.log(`      ✅ [ZZMALL] Clique realizado. Aguardando PDP...`);
                                    await page.waitForTimeout(5000);

                                    const checkUrl = page.url();
                                    if (!checkUrl.includes('/p') && !checkUrl.includes('/produto') && !checkUrl.includes('/search/')) {
                                        console.log(`   ❌ [ZZMALL] BLOQUEADO: Página inválida após clique.`);
                                        continue;
                                    }
                                } else {
                                    console.log(`      ⚠️ [ZZMALL] Nenhum item clicável encontrado no seletor.`);
                                }
                            }
                        }

                        let finalPageUrl = page.url();
                        let isProductPage = finalPageUrl.includes('/p') || finalPageUrl.includes('/produto');

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

                            const currentUrlBeforeHref = page.url();
                            if (!currentUrlBeforeHref.includes('/p') && !currentUrlBeforeHref.includes('/produto') && !currentUrlBeforeHref.includes('/search/')) {
                                console.log(`   ❌ [${storeName.toUpperCase()}] Abortando: Landing page inválida.`);
                                continue;
                            }
                        }

                        // Final ID Verification for ZZMall
                        if (storeName === 'zzmall') {

                            // Verify if the ID on page matches what we searched for
                            const pageId = await page.evaluate(() => {
                                const refEl = document.querySelector('.vtex-product-identifier, .productReference');
                                if (!refEl) return '';
                                // ZZMall IDs are alphanumeric, we should keep letters and numbers
                                const text = refEl.innerText || '';
                                return text.trim();
                            });

                            if (pageId && !pageId.toLowerCase().includes(item.id.toLowerCase()) && !item.id.toLowerCase().includes(pageId.toLowerCase())) {
                                console.log(`   ❌ [ZZMALL] ID Errado na página: Encontrou ${pageId} mas queria ${item.id}. Abortando.`);
                                continue;
                            }
                        }

                        // Final Parse
                        if (storeName === 'dressto') product = await parseProductDressTo(page, page.url());
                        else if (storeName === 'kju') product = await parseProductKJU(page, page.url());
                        else if (storeName === 'live') product = await parseProductLive(page, page.url());
                        else if (storeName === 'zzmall') product = await parseProductZZMall(page, page.url());

                        if (product) {
                            product.loja = storeName;
                            product.brand = storeName === 'dressto' ? 'DRESS' : storeName.toUpperCase();
                            product.favorito = !!item.isFavorito;
                            product.novidade = !!item.novidade;
                            product.id = item.driveId || product.id || item.id;

                            collectedProducts.push(product);
                            stats.found++;
                            if (collectedProducts.length >= quota) break;
                            if (!product.favorito) markAsSent([product.id]);
                        }
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
            if (ownsPage) await page.close();
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
