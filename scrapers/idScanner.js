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
        searchUrl: (id) => `https://www.kjubrasil.com/buscar?q=${id}`,
        searchInputSelector: 'input[type="search"], input.search',
        productLinkSelector: '.prod a, a[href*="/produto"]',
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
 * @param {object} browser Playwright Browser instance
 * @param {Array} driveItems Lista de objetos { id, driveUrl, isFavorito, store }
 * @param {string} storeName Nome da loja (dressto, kju, zzmall, live)
 */
async function scrapeSpecificIdsGeneric(browser, driveItems, storeName) {
    const config = STORE_CONFIG[storeName];
    if (!config) {
        console.log(`❌ [ID Scanner] Loja não configurada: ${storeName}`);
        return [];
    }

    console.log(`\n🔍 [${storeName.toUpperCase()}] DRIVE-FIRST: Buscando ${driveItems.length} itens...`);

    const page = await browser.newPage();
    const collectedProducts = [];

    try {
        for (const item of driveItems) {
            console.log(`\n🔍 [${storeName}] Buscando ID ${item.id} (Favorito: ${item.isFavorito})...`);

            try {
                // Estratégia 1: VTEX Full-Text Search URL (funciona para DressTo, ZZMall, Live)
                const searchUrl = config.searchUrl(item.id);
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 2000));

                // Verifica se estamos em uma página de resultados ou produto direto
                const currentUrl = page.url();
                let isProductPage = currentUrl.includes('/p') || currentUrl.includes('/produto');

                if (!isProductPage) {
                    // Estamos na página de busca, precisa clicar no primeiro resultado
                    try {
                        await page.waitForSelector(config.productLinkSelector, { timeout: 10000 });
                        await new Promise(r => setTimeout(r, 1000));

                        const productLink = page.locator(config.productLinkSelector).first();
                        await productLink.scrollIntoViewIfNeeded();
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
                            productLink.click({ force: true })
                        ]);
                    } catch (navErr) {
                        console.log(`   ❌ Produto ${item.id} não encontrado na busca de ${storeName}`);
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
