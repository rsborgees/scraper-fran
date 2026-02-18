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
        // Direct search URL that often shows results instead of redirecting
        directUrlBuilder: (id) => `https://www.dressto.com.br/${id}?_q=${id}&map=ft&sc=1`,
        searchUrl: (id) => `https://www.dressto.com.br/${id}?_q=${id}&map=ft&sc=1`,
        searchInputSelector: 'input[type="search"], input[placeholder*="Buscar"], .vtex-store-components-3-x-searchBarIcon',
        // Updated selector to match research
        productLinkSelector: 'a.vtex-product-summary-2-x-clearLink, a[href$="/p"], .vtex-product-summary-2-x-image',
        parser: 'dressto',
        utmParam: null
    },
    kju: {
        baseUrl: 'https://www.kjubrasil.com',
        // KJU direct URL /ID/p fails, so we rely on search.
        directUrlBuilder: null,
        searchUrl: (id) => `https://www.kjubrasil.com/busca/?q=${id}`,
        searchInputSelector: 'input[name="q"], input.search',
        // Updated robust selector for KJU (WBUY structure)
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
 * @param {object} contextOrBrowser Playwright Browser or BrowserContext instance
 * @param {Array} driveItems Lista de objetos { id, driveUrl, isFavorito, store }
 * @param {string} storeName Nome da loja (dressto, kju, zzmall, live)
 * @param {number} quota Meta máxima de itens para esta loja
 * @returns {Promise<{products: Array, attemptedIds: Array, stats: object}>}
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

    // Separa itens por Nome (Feature Live) e por ID (Padrão)
    const nameBasedItems = driveItems.filter(i => i.searchByName);
    const idBasedItems = driveItems.filter(i => !i.searchByName);

    // 1. Processa itens por ID (Padrão)
    if (idBasedItems.length > 0) {
        const page = await contextOrBrowser.newPage({
            // Synchronized with browser_setup.js for consistent anti-detection
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale: 'pt-BR',
            extraHTTPHeaders: {
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        // Anti-redirection cookie for DressTo (Force BR)
        if (storeName === 'dressto') {
            await contextOrBrowser.addCookies([
                { name: 'vtex_segment', value: 'eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9', domain: '.dressto.com.br', path: '/' }
            ]).catch(() => { });
        }

        try {
            for (const item of idBasedItems) {
                // Stop if quota reached
                if (collectedProducts.length >= quota) {
                    console.log(`   ✅ Meta de ${quota} itens para ${storeName} atingida no Drive.`);
                    break;
                }

                stats.checked++;
                attemptedIds.push(item.id);
                console.log(`\n🔍 [${storeName}] Buscando ID ${item.id} (${item.isFavorito ? '⭐ Favorito' : 'Regular'})...`);

                // Check Duplicates internally (but after logging attempt so user sees progress)
                const normIdCheck = normalizeId(item.id);
                if (!item.isFavorito && isDuplicate(normIdCheck, { maxAgeHours })) {
                    console.log(`   ⏭️  Pulando: Já enviado recentemente.`);
                    stats.duplicates++;
                    continue;
                }

                try {
                    // --- ESTRATÉGIA DE NAVEGAÇÃO ---
                    let navigationSuccess = false;

                    // DressTo: Estratégia especial para evitar "Render Server Error"
                    if (storeName === 'dressto') {
                        try {
                            // 1. Navega para a home primeiro para estabelecer sessão
                            console.log('      🏠 Navegando para home DressTo...');
                            await page.goto('https://www.dressto.com.br/', { waitUntil: 'domcontentloaded', timeout: 45000 });
                            await page.waitForTimeout(3000);

                            // 2. Verifica se não foi redirecionado para versão global
                            let title = await page.title().catch(() => '');
                            if (title.includes('Bringing Joy') || title.includes('Fashion')) {
                                console.log(`      ⚠️ Redirecionamento global detectado. Forçando BR...`);
                                await page.goto('https://www.dressto.com.br/?sc=1', { waitUntil: 'domcontentloaded' });
                                await page.waitForTimeout(2000);
                            }

                            // 3. Usa a busca do site ao invés de URL direta
                            console.log(`      🔍 Buscando ID ${item.id} via campo de busca...`);
                            const searchInput = '#downshift-0-input, input[placeholder*="Digite sua busca"], input[placeholder*="buscar"]';
                            const searchIcon = 'button[title="Buscar"], [class*="SearchCustom_icon"]';

                            // Tenta abrir o campo de busca se necessário
                            const isVisible = await page.isVisible(searchInput).catch(() => false);
                            if (!isVisible) {
                                const hasIcon = await page.isVisible(searchIcon).catch(() => false);
                                if (hasIcon) {
                                    await page.click(searchIcon);
                                    await page.waitForTimeout(1000);
                                }
                            }

                            // Preenche e busca
                            await page.waitForSelector(searchInput, { state: 'visible', timeout: 15000 });
                            await page.fill(searchInput, item.id);
                            await page.press(searchInput, 'Enter');
                            await page.waitForTimeout(3000);

                            // Verifica se chegou em uma página de resultados ou produto
                            const currentUrl = page.url();
                            if (currentUrl.includes('/p')) {
                                // Já está na página do produto
                                navigationSuccess = true;
                            } else {
                                // Está na listagem, precisa clicar no produto
                                // 4. Fallback se necessário: URL Direta de Busca
                                if (!navigationSuccess) {
                                    console.log(`      🔍 Tentando busca direta por ID: ${item.id}...`);
                                    const directSearchUrl = `https://www.dressto.com.br/${item.id}?_q=${item.id}&map=ft`;
                                    await page.goto(directSearchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                    await page.waitForTimeout(3000);
                                    if (page.url().includes('/p')) {
                                        navigationSuccess = true;
                                    }
                                }
                                navigationSuccess = true;
                            }

                        } catch (dresstoErr) {
                            console.log(`      ❌ Erro na estratégia DressTo: ${dresstoErr.message}`);
                            // Fallback para URL direta mesmo assim
                        }
                    }

                    // Para outras lojas ou fallback DressTo, usa a URL direta
                    if (!navigationSuccess && config.directUrlBuilder) {
                        const directUrl = config.directUrlBuilder(item.id);
                        try {
                            await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
                            navigationSuccess = true;
                            await new Promise(r => setTimeout(r, 1500));
                        } catch (e) {
                            console.log(`      ⚠️ Falha na Direct URL: ${e.message}`);
                        }
                    }

                    if (!navigationSuccess) {
                        const searchUrl = config.searchUrl(item.id);
                        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
                        await new Promise(r => setTimeout(r, 2500));
                    }

                    // --- DETECÇÃO DE RESULTADO ---
                    let currentUrl = page.url();
                    let isProductPage = currentUrl.includes('/p') || currentUrl.includes('/produto');

                    if (!isProductPage) {
                        isProductPage = await page.evaluate(() => {
                            return !!document.querySelector('.codigo_produto, .productReference, [itemprop="identifier"], .vtex-product-identifier');
                        });
                    }

                    if (!isProductPage) {
                        // Não é página de produto. Verifica se é lista ou 404.
                        const notFound = await page.evaluate(() => {
                            const text = document.body.innerText || '';
                            return text.includes('Nenhum produto foi encontrado') ||
                                text.includes('não encontrado') ||
                                text.includes('Ops, sua busca') ||
                                text.includes('Página inválida') ||
                                text.includes('NÃO ENCONTRAMOS O QUE VOCÊ BUSCOU');
                        });

                        if (notFound) {
                            console.log(`   ❌ Produto ${item.id} não disponível no site.`);
                            stats.notFound++;
                            continue;
                        }

                        // Tenta encontrar o link
                        try {
                            const selector = config.productLinkSelector;
                            // Add a dynamic selector based on the ID we are looking for
                            const idSelector = `a[href*="${item.id}"]`;

                            // Increased timeout for link detection in server environments
                            try {
                                await page.waitForSelector(`${selector}, ${idSelector}`, { timeout: (storeName === 'dressto' || storeName === 'zzmall') ? 45000 : 10000 });
                            } catch (e) {
                                const pageTitle = await page.title().catch(() => 'N/A');
                                console.log(`      ⚠️ Timeout esperando link (${item.id}) [Title: ${pageTitle}]`);
                            }

                            let href = await page.evaluate(({ sel, idSel }) => {
                                // Try ID specific selector first
                                const idLink = document.querySelector(idSel);
                                if (idLink && idLink.href && !idLink.href.includes('javascript')) return idLink.href;

                                const anchors = Array.from(document.querySelectorAll(sel));
                                for (const a of anchors) {
                                    if (a.href && !a.href.includes('javascript') && !a.href.includes('#')) return a.href;
                                }
                                return null;
                            }, { sel: selector, idSel: idSelector });

                            // --- [FALLBACK HTML SEARCH] ---
                            if (!href && (storeName === 'dressto' || storeName === 'zzmall')) {
                                console.log(`      🔍 Link não encontrado por seletor. Tentando busca exaustiva no HTML para ID ${item.id}...`);
                                href = await page.evaluate((id) => {
                                    const allLinks = Array.from(document.querySelectorAll('a'));
                                    // Look for any link that contains the ID in its href (VTEX slugs usually have the ID)
                                    const match = allLinks.find(a => a.href && a.href.includes(id) && !a.href.includes('javascript'));
                                    return match ? match.href : null;
                                }, item.id);
                            }

                            if (href) {
                                console.log(`   🔗 Link encontrado: ${href}`);
                                await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                await new Promise(r => setTimeout(r, 1500));
                            } else {
                                // 🆘 FALLBACK ESPECIAL DRESSTO: Se não achou link E tem erro 500, pula navegação
                                if (storeName === 'dressto') {
                                    const pageTitle = await page.title().catch(() => 'unknown');
                                    if (pageTitle.includes('Render Server - Error')) {
                                        console.log(`   🆘 Erro 500 detectado no ID Scanner. Delegando para parser com fallback API...`);
                                        // Não precisa navegar - o parser vai detectar o erro 500 e usar a API
                                        // Continua para o parse abaixo
                                    } else {
                                        // Não é erro 500, é realmente produto não encontrado
                                        const path = require('path');
                                        const fs = require('fs');
                                        const debugDir = path.join(__dirname, '../debug');
                                        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
                                        const debugName = `debug_id_fail_${storeName}_${item.id}_${Date.now()}.png`;
                                        await page.screenshot({ path: path.join(debugDir, debugName) }).catch(() => { });
                                        console.log(`   ❌ Link não encontrado na listagem. Print salvo: debug/${debugName}`);
                                        stats.notFound++;
                                        continue;
                                    }
                                } else {
                                    // Outras lojas - comportamento normal
                                    const path = require('path');
                                    const fs = require('fs');
                                    const debugDir = path.join(__dirname, '../debug');
                                    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
                                    const debugName = `debug_id_fail_${storeName}_${item.id}_${Date.now()}.png`;
                                    await page.screenshot({ path: path.join(debugDir, debugName) }).catch(() => { });
                                    console.log(`   ❌ Link não encontrado na listagem. Print salvo: debug/${debugName}`);
                                    stats.notFound++;
                                    continue;
                                }
                            }
                        } catch (navErr) {
                            console.log(`   ❌ Erro ao navegar para o link: ${navErr.message}`);
                            stats.errors++;
                            continue;
                        }
                    }

                    // --- PARSE ---
                    const finalUrl = page.url();
                    let product = null;

                    if (config.parser === 'dressto') product = await parseProductDressTo(page, finalUrl);
                    else if (config.parser === 'kju') product = await parseProductKJU(page, finalUrl);
                    else if (config.parser === 'zzmall') product = await parseProductZZMall(page, finalUrl);
                    else if (config.parser === 'live') product = await parseProductLive(page, finalUrl);

                    if (product) {
                        // 🖼️ Handle Drive Image (User wants direct Drive Link)
                        if (item.driveUrl) {
                            product.imagePath = item.driveUrl;
                            product.imageUrl = item.driveUrl;
                        } else if (storeName === 'dressto') {
                            // 🛑 DRESS TO STRICT RULE: Only items with Drive URL are allowed.
                            console.log(`   🛑 [DRESSTO] Bloqueando item do Drive sem link de imagem direto.`);
                            continue; // Skip the product
                        }

                        product.favorito = item.isFavorito || false;
                        product.isFavorito = item.isFavorito || false;
                        product.novidade = item.novidade || false;
                        product.isNovidade = item.novidade || (product.isNovidade || false);
                        product.bazar = item.bazar || false;
                        product.bazarFavorito = item.bazarFavorito || false;

                        product.loja = storeName;
                        product.id = item.driveId || (product.id && product.id !== 'unknown' ? product.id : item.id);

                        if (config.utmParam) {
                            product.url = finalUrl.includes('?') ? `${finalUrl}&${config.utmParam}` : `${finalUrl}?${config.utmParam}`;
                        } else {
                            product.url = finalUrl;
                        }

                        collectedProducts.push(product);
                        console.log(`   ✅ [${storeName}] Capturado: ${product.nome}`);
                        stats.found++;

                        if (!item.isFavorito) markAsSent([product.id]);

                    } else {
                        console.log(`   ❌ Falha ao parsear dados (Produto pode estar sem estoque)`);
                        stats.errors++;
                    }

                } catch (err) {
                    console.error(`   ❌ Erro no processamento de ${item.id}: ${err.message}`);
                    stats.errors++;
                }

                await new Promise(r => setTimeout(r, 1000));
            }

        } catch (globalErr) {
            console.error(`❌ Erro crítico no ID Scanner ${storeName}:`, globalErr.message);
        } finally {
            await page.close();
        }
    }

    // 2. Processa itens por Nome (Feature Live)
    if (storeName === 'live' && nameBasedItems.length > 0) {
        const remainingQuota = quota - collectedProducts.length;
        if (remainingQuota > 0) {
            console.log(`\n🚙 Delegando ${nameBasedItems.length} itens Live por nome...`);
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
