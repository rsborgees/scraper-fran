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

// Configurações por loja
const STORE_CONFIG = {
    dressto: {
        baseUrl: 'https://www.dressto.com.br',
        // Direct search URL that often shows results instead of redirecting
        directUrlBuilder: (id) => `https://www.dressto.com.br/${id}?_q=${id}&map=ft`,
        searchUrl: (id) => `https://www.dressto.com.br/${id}?_q=${id}&map=ft`,
        searchInputSelector: 'input[type="search"], input[placeholder*="Buscar"], .vtex-store-components-3-x-searchBarIcon',
        // Updated selector to match research
        productLinkSelector: '.dresstoshop-commercegrowth-custom-0-x-skuselector__item, a.vtex-product-summary-2-x-clearLink, a[href$="/p"]',
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
        directUrlBuilder: (id) => `https://www.zzmall.com.br/${id}?map=ft`,
        searchUrl: (id) => `https://www.zzmall.com.br/${id}?map=ft`,
        searchInputSelector: 'input[type="search"], .vtex-store-components-3-x-searchBarIcon',
        productLinkSelector: 'a[href*="/p/"], a.vtex-product-summary-2-x-clearLink',
        parser: 'zzmall',
        utmParam: 'influ=cupomdafran'
    },
    live: {
        baseUrl: 'https://www.liveoficial.com.br',
        directUrlBuilder: (id) => `https://www.liveoficial.com.br/${id}?map=ft`,
        searchUrl: (id) => `https://www.liveoficial.com.br/${id}?map=ft`,
        searchInputSelector: 'input[type="search"], .search-input',
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
async function scrapeSpecificIdsGeneric(contextOrBrowser, driveItems, storeName, quota = 999) {
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
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

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
                if (!item.isFavorito && isDuplicate(normIdCheck)) {
                    console.log(`   ⏭️  Pulando: Já enviado recentemente.`);
                    stats.duplicates++;
                    continue;
                }

                try {
                    // --- ESTRATÉGIA DE NAVEGAÇÃO ---
                    let navigationSuccess = false;

                    // Para DressTo, usamos a busca direta que é mais estável
                    if (config.directUrlBuilder) {
                        const directUrl = config.directUrlBuilder(item.id);
                        try {
                            const waitCondition = storeName === 'dressto' ? 'networkidle' : 'domcontentloaded';
                            await page.goto(directUrl, { waitUntil: waitCondition, timeout: 45000 });
                            await new Promise(r => setTimeout(r, 2000));
                            navigationSuccess = true;
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
                                text.includes('Página inválida');
                        });

                        if (notFound) {
                            console.log(`   ❌ Produto ${item.id} não disponível no site.`);
                            stats.notFound++;
                            continue;
                        }

                        // Tenta encontrar o link
                        try {
                            const selector = config.productLinkSelector;
                            const href = await page.evaluate((sel) => {
                                const anchors = Array.from(document.querySelectorAll(sel));
                                for (const a of anchors) {
                                    if (a.href && !a.href.includes('javascript') && !a.href.includes('#')) return a.href;
                                }
                                return null;
                            }, selector);

                            if (href) {
                                console.log(`   🔗 Link encontrado: ${href}`);
                                await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                await new Promise(r => setTimeout(r, 1500));
                            } else {
                                // Diagnostic Screenshot
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
                        product.imageUrl = item.driveUrl;
                        product.imagePath = item.driveUrl;
                        product.favorito = item.isFavorito || false;
                        product.loja = storeName;
                        product.id = product.id && product.id !== 'unknown' ? product.id : item.id;

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
