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

// Configurações por loja
const STORE_CONFIG = {
    dressto: {
        baseUrl: 'https://www.dressto.com.br',
        searchUrl: (id) => `https://www.dressto.com.br/${id}?map=ft`,
        searchInputSelector: 'input[type="search"], input[placeholder*="Buscar"], .vtex-store-components-3-x-searchBarIcon',
        productLinkSelector: 'a.vtex-product-summary-2-x-clearLink, a[href$="/p"]',
        parser: 'dressto',
        utmParam: null
    },
    kju: {
        baseUrl: 'https://www.kjubrasil.com',
        searchUrl: (id) => `https://www.kjubrasil.com/busca/?q=${id}`,
        searchInputSelector: 'input[name="q"], input.search',
        productLinkSelector: '.produtos .item a, .prod a, a.b_acao',
        parser: 'kju',
        utmParam: 'ref=7B1313'
    },
    zzmall: {
        baseUrl: 'https://www.zzmall.com.br',
        searchUrl: (id) => `https://www.zzmall.com.br/${id}?map=ft`,
        searchInputSelector: 'input[type="search"], .vtex-store-components-3-x-searchBarIcon',
        productLinkSelector: 'a[href*="/p/"], a.vtex-product-summary-2-x-clearLink',
        parser: 'zzmall',
        utmParam: 'influ=cupomdafran'
    },
    live: {
        baseUrl: 'https://www.liveoficial.com.br',
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
    const page = await contextOrBrowser.newPage();

    try {
        for (const item of driveItems) {
            // Stop if quota reached
            if (collectedProducts.length >= quota) {
                console.log(`   ✅ Meta de ${quota} itens para ${storeName} atingida no Drive.`);
                break;
            }

            console.log(`\n🔍 [${storeName}] Buscando ID ${item.id} (Favorito: ${item.isFavorito})...`);

            try {
                // Estratégia 1: VTEX Full-Text Search URL (funciona para DressTo, ZZMall, Live)
                const searchUrl = config.searchUrl(item.id);
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 2000));

                // Verifica se estamos em uma página de resultados ou produto direto
                let currentUrl = page.url();

                // Redirection check: if search redirected to product page
                let isProductPage = currentUrl.includes('/p') || currentUrl.includes('/produto');

                // Advanced detection (if store doesn't use /p/ or /produto/)
                if (!isProductPage) {
                    isProductPage = await page.evaluate(() => {
                        return !!document.querySelector('.codigo_produto, .productReference, [itemprop="identifier"], .vtex-product-identifier');
                    });
                }

                if (isProductPage) {
                    console.log(`   ✨ Redirecionado direto para o produto!`);
                } else {
                    // Try to catch the first result link and navigate directly
                    try {
                        const selector = config.productLinkSelector;
                        console.log(`   🖱️ Procurando seletor: ${selector}`);
                        await page.waitForSelector(selector, { state: 'attached', timeout: 10000 });

                        const href = await page.evaluate((sel) => {
                            const el = document.querySelector(sel);
                            return el ? el.href : null;
                        }, selector);

                        if (href) {
                            console.log(`   🔗 Navegando diretamente para o resultado: ${href}`);
                            await page.goto(href, { waitUntil: 'load', timeout: 30000 });
                        } else {
                            throw new Error('Link not found');
                        }
                    } catch (navErr) {
                        console.log(`   ❌ Produto ${item.id} não encontrado na busca de ${storeName} (Erro: ${navErr.message})`);
                        continue;
                    }
                }

                // Parse do produto usando o parser específico da loja
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
                        product.url = finalUrl.includes('?')
                            ? `${finalUrl}&${config.utmParam}`
                            : `${finalUrl}?${config.utmParam}`;
                    } else {
                        product.url = finalUrl;
                    }

                    // Verificação de duplicatas
                    const normId = normalizeId(product.id);
                    const isDup = isDuplicate(normId, { force: item.isFavorito });

                    if (!isDup) {
                        collectedProducts.push(product);
                        console.log(`   ✅ [${storeName}] Capturado: ${product.nome}`);

                        if (!item.isFavorito) {
                            markAsSent([product.id]);
                        }
                    } else {
                        console.log(`   ⏭️  Skip: Duplicado no histórico.`);
                    }
                } else {
                    console.log(`   ❌ Falha ao parsear produto na ${storeName}`);
                }

            } catch (err) {
                console.error(`   ❌ Erro ao processar ID ${item.id} na ${storeName}: ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 1000));
        }

    } catch (globalErr) {
        console.error(`❌ Erro crítico no ID Scanner ${storeName}:`, globalErr.message);
    } finally {
        await page.close();
    }

    console.log(`🏁 [${storeName.toUpperCase()}] DRIVE-FIRST: ${collectedProducts.length} itens recuperados.\n`);
    return collectedProducts;
}

module.exports = { scrapeSpecificIdsGeneric, STORE_CONFIG };
