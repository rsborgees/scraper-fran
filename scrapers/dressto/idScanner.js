const { parseProductDressTo } = require('./parser');
const { appendQueryParams } = require('../../urlUtils');
const { normalizeId, isDuplicate, markAsSent } = require('../../historyManager');

/**
 * Scraper focado em IDs específicos para Dress To (vindos do Drive)
 * @param {object} browser Playwright Browser instance
 * @param {Array} driveItems Lista de objetos { id, driveUrl, isFavorito, ... }
 */
async function scrapeSpecificIdsDressTo(browser, driveItems, quota = 999) {
    console.log(`\n🚙 INICIANDO SCRAPE DRIVE-FIRST [Dress To] (${driveItems.length} itens disponíveis, meta: ${quota})...`);

    const page = await browser.newPage();
    const collectedProducts = [];

    // Dress To também usa VTEX, então a estrutura de busca é similar, mas vamos validar selectors
    // URL Base: https://www.dressto.com.br

    try {
        for (const item of driveItems) {
            // Stop if quota reached
            if (collectedProducts.length >= quota) {
                console.log(`   ✅ [DressTo] Meta de ${quota} itens do Drive atingida.`);
                break;
            }

            console.log(`\n🔍 [DressTo] Buscando ID ${item.id} (Favorito: ${item.isFavorito})...`);

            try {
                // 1. Navega para a home (ou busca direta se URL permitir, mas VTEX search é chata)
                await page.goto(`https://www.dressto.com.br`, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for stability
                await new Promise(r => setTimeout(r, 1500));

                try {
                    // Click Search Icon (Lupa)
                    // Na Dress To, geralmente tem um botao de busca ou input direto
                    // Selector comum VTEX: .vtex-store-components-3-x-searchIcon, ou input direto

                    // Tenta achar o input direto primeiro se visivel, ou clica na lupa
                    // Tenta achar o input direto primeiro se visivel, ou clica na lupa
                    const searchInputSelector = '#downshift-0-input, input[placeholder="Digite sua busca"], input[placeholder*="buscar"]';
                    const searchIconSelector = 'button[title="Buscar"], .dresstoshop-commercegrowth-custom-0-x-SearchCustom_icon, .dresstoshop-commercegrowth-custom-0-x-SearchCustom_iconClose';

                    const isInputVisible = await page.isVisible(searchInputSelector).catch(() => false);
                    if (!isInputVisible) {
                        try {
                            if (await page.isVisible(searchIconSelector)) {
                                await page.click(searchIconSelector);
                                await page.waitForTimeout(1000);
                            }
                        } catch (e) {
                            console.log('      ⚠️ Erro ao clicar no ícone de busca:', e.message);
                        }
                    }

                    // Tenta garantir que o input está visível antes de preencher
                    await page.waitForSelector(searchInputSelector, { state: 'visible', timeout: 5000 });
                    await page.fill(searchInputSelector, item.id);
                    await page.press(searchInputSelector, 'Enter');

                    // Wait for results
                    // VTEX Results
                    const productLinkSelector = 'a.vtex-product-summary-2-x-clearLink';
                    await page.waitForSelector(productLinkSelector, { timeout: 15000 });

                    // Click First Result
                    const productLink = page.locator(productLinkSelector).first();
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
                        productLink.click({ force: true })
                    ]);

                } catch (searchErr) {
                    console.log(`   ❌ [DressTo] Produto ${item.id} não encontrado via busca: ${searchErr.message}`);
                    continue;
                }

                // Check URL
                const url = page.url();
                if (!url.includes('/p') && !url.includes('/produto')) {
                    console.log(`   ❌ [DressTo] Redirecionamento falhou: ${url}`);
                    continue;
                }

                // 2. Parse
                const product = await parseProductDressTo(page, url);

                if (product) {
                    // 3. IMAGE LOGIC (Drive Priority -> Fallback to Cloudinary)
                    if (item.driveUrl && item.driveUrl.includes('drive.google.com')) {
                        product.imageUrl = item.driveUrl;
                        product.imagePath = item.driveUrl;
                        console.log(`      🖼️  Usando imagem do Drive.`);
                    } else {
                        // Fallback
                        console.log(`      ⚠️  Imagem do Drive ausente para ID ${item.id}. Fallback...`);
                        const { processImageDirect, processProductUrl } = require('../../imageDownloader');
                        let imagePath = null;
                        try {
                            const imgResult = await processProductUrl(url, product.id);
                            if (imgResult.status === 'success' && imgResult.cloudinary_urls?.length > 0) {
                                imagePath = imgResult.cloudinary_urls[0];
                            }
                        } catch (e) {
                            console.error(`      ❌ Erro no fallback de imagem: ${e.message}`);
                        }
                        product.imagePath = imagePath || 'error.jpg';
                    }

                    product.favorito = item.isFavorito || false;
                    product.loja = 'dressto';

                    // Ajustes específicos Dress To
                    product.desconto = 0; // Dress To geralmente é full price no scraper atual ou outlet? Scraper diz "nossas-novidades", assumindo full price na busca especifica tb, mas parser decide.

                    const normId = normalizeId(product.id);
                    const isDup = isDuplicate(normId, { force: item.isFavorito });

                    if (!isDup) {
                        collectedProducts.push(product);
                        console.log(`   ✅ [DressTo] Capturado via Drive: ${product.nome}`);
                        if (!item.isFavorito) markAsSent([product.id]);
                    } else {
                        console.log(`   ⏭️  [DressTo] Duplicado.`);
                    }
                }

            } catch (err) {
                console.error(`   ❌ [DressTo] Erro ID ${item.id}: ${err.message}`);
            }
            await new Promise(r => setTimeout(r, 1000));
        }

    } catch (globalErr) {
        console.error('❌ Erro crítico DressTo Drive-First:', globalErr.message);
    } finally {
        await page.close();
    }

    return collectedProducts;
}

module.exports = { scrapeSpecificIdsDressTo };
