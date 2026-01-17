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
        // User provided specific robust URL pattern
        directUrlBuilder: (id) => `https://www.dressto.com.br/${id}?_q=${id}&map=ft`,
        // Fallback search (though directUrlBuilder acts as a search too)
        searchUrl: (id) => `https://www.dressto.com.br/${id}?map=ft`,
        searchInputSelector: 'input[type="search"], input[placeholder*="Buscar"], .vtex-store-components-3-x-searchBarIcon',
        productLinkSelector: 'a.vtex-product-summary-2-x-clearLink, a[href$="/p"]',
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
 * Scraper focado em IDs específicos para múltiplas lojas
 * @param {object} contextOrBrowser Playwright Browser or BrowserContext instance
 * @param {Array} driveItems Lista de objetos { id, driveUrl, isFavorito, store }
 * @param {string} storeName Nome da loja (dressto, kju, zzmall, live)
 * @param {number} quota Meta máxima de itens para esta loja
 */
async function scrapeSpecificIdsGeneric(contextOrBrowser, driveItems, storeName, quota = 999) {
    const config = STORE_CONFIG[storeName];
    if (!config) {
        console.log(`❌ [ID Scanner] Loja não configurada: ${storeName}`);
        return [];
    }

    console.log(`\n🔍 [${storeName.toUpperCase()}] DRIVE-FIRST: Buscando ${driveItems.length} itens (Meta: ${quota})...`);

    const collectedProducts = [];

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

                console.log(`\n🔍 [${storeName}] Buscando ID ${item.id} (${item.driveUrl ? 'Com Drive URL' : 'Sem Drive URL'})...`);

                try {
                    // --- ESTRATÉGIA DE NAVEGAÇÃO ---

                    // 1. Tenta Direct URL (se configurada)
                    // Para DressTo, isso é uma URL de busca robusta.
                    let navigationSuccess = false;

                    if (config.directUrlBuilder) {
                        const directUrl = config.directUrlBuilder(item.id);
                        try {
                            // console.log(`      🚀 Tentando Direct URL: ${directUrl}`);
                            await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
                            await new Promise(r => setTimeout(r, 2000));
                            navigationSuccess = true;
                        } catch (e) {
                            console.log(`      ⚠️ Falha na Direct URL: ${e.message}`);
                        }
                    }

                    // 2. Se não tem Direct URL configurada ou falhou muito feio, usa Search URL padrão
                    if (!navigationSuccess) {
                        const searchUrl = config.searchUrl(item.id);
                        // console.log(`      🔎 Tentando Search URL: ${searchUrl}`);
                        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
                        await new Promise(r => setTimeout(r, 2000));
                    }

                    // --- DETECÇÃO DE RESULTADO ---

                    let currentUrl = page.url();
                    let isProductPage = currentUrl.includes('/p') || currentUrl.includes('/produto');

                    // Advanced detection (if store doesn't use /p/ or /produto/ in URL)
                    if (!isProductPage) {
                        isProductPage = await page.evaluate(() => {
                            return !!document.querySelector('.codigo_produto, .productReference, [itemprop="identifier"], .vtex-product-identifier');
                        });
                    }

                    if (isProductPage) {
                        console.log(`   ✨ Página do produto detectada!`);
                    } else {
                        // Não é página de produto direta. Verifica se é lista de resultados.

                        // Primeiro, check de "Não Encontrado" explícito
                        const notFound = await page.evaluate(() => {
                            const text = document.body.innerText || '';
                            return text.includes('Nenhum produto foi encontrado') ||
                                text.includes('não encontrado') ||
                                text.includes('Ops, sua busca') ||
                                text.includes('Página inválida');
                        });

                        if (notFound) {
                            console.log(`   ❌ Produto ${item.id} não encontrado (Store msg).`);
                            continue;
                        }

                        // Tenta encontrar o link do produto na listagem
                        try {
                            const selector = config.productLinkSelector;
                            // console.log(`      🖱️ Procurando link c/ seletor: ${selector}`);

                            // Busca link que não seja "indesejado" (ex: filtro, categoria etc)
                            const href = await page.evaluate((sel) => {
                                const anchors = Array.from(document.querySelectorAll(sel));
                                // Procura o primeiro link visível e válido
                                for (const a of anchors) {
                                    if (a.href && !a.href.includes('javascript') && !a.href.includes('#')) {
                                        return a.href;
                                    }
                                }
                                return null;
                            }, selector);

                            if (href) {
                                console.log(`   🔗 Link encontrado na busca: ${href}`);
                                await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                await new Promise(r => setTimeout(r, 1500));
                            } else {
                                // Scraper KJU as vezes falha aqui.

                                // Fallback: Procura qualquer link que contenha o ID ou pareça produto
                                const fallbackHref = await page.evaluate((item) => {
                                    const id = item.id;
                                    const allLinks = Array.from(document.querySelectorAll('a'));
                                    // Tenta link contendo o ID
                                    const idLink = allLinks.find(a => a.href.includes(id) && !a.href.includes('busca'));
                                    if (idLink) return idLink.href;

                                    // KJU Simple Fallback: Just grab the first product item link found
                                    const simpleLink = document.querySelector('.produtos .item a, .list_products .item a, .prod a');
                                    if (simpleLink) return simpleLink.href;

                                    return null;
                                }, item); // Pass full item object


                                if (fallbackHref) {
                                    console.log(`   🔗 Link (fallback) encontrado: ${fallbackHref}`);
                                    await page.goto(fallbackHref, { waitUntil: 'load', timeout: 30000 });
                                } else {
                                    throw new Error('Link visual do produto não encontrado na listagem');
                                }
                            }
                        } catch (navErr) {
                            console.log(`   ❌ Link não encontrado na listagem: ${navErr.message}`);
                            continue;
                        }
                    }

                    // --- PARSE DO PRODUTO (JÁ NA PÁGINA) ---
                    const finalUrl = page.url();
                    let product = null;

                    if (config.parser === 'dressto') {
                        product = await parseProductDressTo(page, finalUrl);
                    } else if (config.parser === 'kju') {
                        product = await parseProductKJU(page, finalUrl);
                    } else if (config.parser === 'zzmall') {
                        product = await parseProductZZMall(page, finalUrl);
                    } else if (config.parser === 'live') {
                        product = await parseProductLive(page, finalUrl);
                    }

                    if (product) {
                        // Sobrescreve com dados do Drive
                        product.imageUrl = item.driveUrl;
                        product.imagePath = item.driveUrl;
                        product.favorito = item.isFavorito || false;
                        product.loja = storeName;

                        // Adiciona UTM se configurado
                        if (config.utmParam) {
                            product.url = finalUrl.includes('?') && !finalUrl.includes(config.utmParam)
                                ? `${finalUrl}&${config.utmParam}`
                                : (finalUrl.includes(config.utmParam) ? finalUrl : `${finalUrl}?${config.utmParam}`);
                        } else {
                            product.url = finalUrl;
                        }

                        // Verificação de duplicatas
                        const normId = normalizeId(product.id);
                        const isDup = isDuplicate(normId, { force: item.isFavorito });

                        // Log para debug KJU
                        // if (storeName === 'kju') console.log(`      DEBUG KJU: Parsed ID ${product.id} vs Target ${item.id}`);

                        if (!product.id || product.id === 'unknown') {
                            // Fallback id from target if parser failed to get ID but got product
                            console.log(`      ⚠️ ID não extraído do site. Usando ID alvo: ${item.id}`);
                            product.id = item.id;
                        }

                        if (!isDup) {
                            collectedProducts.push(product);
                            console.log(`   ✅ [${storeName}] Capturado: ${product.nome}`);

                            if (!item.isFavorito) {
                                markAsSent([product.id]);
                            }
                        } else {
                            console.log(`   ⏭️  [${storeName}] Duplicado no histórico.`);
                        }
                    } else {
                        console.log(`   ❌ Falha ao parsear dados do produto.`);
                    }

                } catch (err) {
                    console.error(`   ❌ Erro ao processar ID ${item.id}: ${err.message}`);
                }

                // Throttle
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
            } catch (e) {
                console.error(`❌ Erro no scrapeLiveByName: ${e.message}`);
            }
        }
    }

    // console.log(`🏁 [${storeName.toUpperCase()}] DRIVE-FIRST End: ${collectedProducts.length} itens.`);
    return collectedProducts;
}

module.exports = { scrapeSpecificIdsGeneric, STORE_CONFIG };
