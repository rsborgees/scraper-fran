const { parseProduct } = require('./parser');
const { appendQueryParams } = require('../../urlUtils');
const { normalizeId, isDuplicate, markAsSent } = require('../../historyManager');

/**
 * Scraper focado em IDs específicos (vindos do Drive)
 * @param {object} browser Playwright Browser instance
 * @param {Array} driveItems Lista de objetos { id, driveUrl, isFavorito, ... }
 */
async function scrapeSpecificIds(browser, driveItems, quota = 999) {
    console.log(`\n🚙 INICIANDO SCRAPE DRIVE-FIRST (${driveItems.length} itens disponíveis, meta: ${quota})...`);

    const page = await browser.newPage();
    const collectedProducts = [];

    // Previne carregamento de imagens pesadas do site, já que vamos usar as do Drive
    // Mas precisamos carregar algumas para o layout não quebrar (opcional)

    try {
        for (const item of driveItems) {
            // Stop if quota reached
            if (collectedProducts.length >= quota) {
                console.log(`   ✅ Meta de ${quota} itens do Drive atingida.`);
                break;
            }

            console.log(`\n🔍 Buscando ID ${item.id} (Favorito: ${item.isFavorito})...`);

            try {
                // 1. Navega para a home e realiza busca interativa
                await page.goto(`https://www.farmrio.com.br`, { waitUntil: 'domcontentloaded', timeout: 30000 });

                try {
                    // Click Search Icon (Lupa)
                    // Selector based on inspection: label[aria-label="open search"] or similar SVG container
                    const searchIconSelector = 'label[aria-label="open search"], .vtex-store-components-3-x-searchIcon';
                    await page.waitForSelector(searchIconSelector, { timeout: 10000 });
                    await page.click(searchIconSelector);

                    // Type ID in Search Input
                    const searchInputSelector = 'input.search-input, input[placeholder*="buscar"]';
                    await page.waitForSelector(searchInputSelector, { state: 'visible', timeout: 5000 });
                    await page.fill(searchInputSelector, item.id);
                    await page.press(searchInputSelector, 'Enter');

                    // Check for 'Not Found' message immediately to avoid clicking recommendations
                    try {
                        // Wait briefly for page update
                        await page.waitForTimeout(2000);

                        const notFound = await page.evaluate(() => {
                            const bodyText = document.body.innerText || '';
                            return bodyText.includes('Ops, sua busca não foi encontrada') ||
                                bodyText.includes('OPS, NÃO ENCONTRAMOS');
                        });

                        if (notFound) {
                            console.log(`   ⚠️ ID ${item.id} não encontrado (Mensagem 'Ops...'). Pulando...`);
                            continue;
                        }
                    } catch (e) { /* Ignore check errors */ }

                    // Wait for results (usar seletor mais robusto)
                    const productLinkSelector = 'a[aria-label="view product"], .vtex-product-summary-2-x-clearLink, .shelf-product-item a';
                    await page.waitForSelector(productLinkSelector, { timeout: 15000 });

                    // Pequeno delay para garantir que os elementos estão clicáveis
                    await new Promise(r => setTimeout(r, 1000));

                    // Click First Result
                    const productLink = page.locator(productLinkSelector).first();
                    await productLink.scrollIntoViewIfNeeded();
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
                        productLink.click({ force: true })
                    ]);

                } catch (searchErr) {
                    console.log(`   ❌ Produto ${item.id} não encontrado via busca interativa: ${searchErr.message}`);
                    continue; // Skip to next ID
                }

                // Check URL after click
                const url = page.url();

                // Validation: Must be a product page
                if (!url.includes('/p') && !url.includes('/produto')) {
                    console.log(`   ❌ Redirecionamento falhou, URL atual: ${url}`);
                    continue;
                }

                // 2. Parse
                const product = await parseProduct(page, url);

                if (product) {
                    // 3. IMAGE LOGIC (Drive Priority -> Fallback to Cloudinary)
                    if (item.driveUrl && item.driveUrl.includes('drive.google.com')) {
                        product.imageUrl = item.driveUrl; // Usa link do Drive
                        product.imagePath = item.driveUrl; // Para compatibilidade
                        console.log(`      🖼️  Usando imagem do Drive.`);
                    } else {
                        // Fallback: Usa imagem do site processada pelo Cloudinary
                        console.log(`      ⚠️  Imagem do Drive ausente para ID ${item.id}. Tentando fallback para Cloudinary...`);
                        const { processImageDirect, processProductUrl } = require('../../imageDownloader');

                        let imagePath = null;
                        try {
                            let imgResult = product.imageUrl ?
                                await processImageDirect(product.imageUrl, 'FARM', product.id) :
                                await processProductUrl(url, product.id);

                            if (imgResult.status === 'success' && imgResult.cloudinary_urls?.length > 0) {
                                imagePath = imgResult.cloudinary_urls[0];
                            }
                        } catch (e) {
                            console.error(`      ❌ Erro no fallback de imagem: ${e.message}`);
                        }

                        product.imagePath = imagePath || 'error.jpg';
                        // Mantém product.imageUrl original do site como referência se precisar
                    }

                    product.favorito = item.isFavorito || false;

                    // Ajustes Finais
                    product.url = appendQueryParams(url, { utm_campaign: "7B1313" });
                    product.loja = 'farm';

                    // Dup check (com override se for favorito)
                    const normId = normalizeId(product.id);
                    const isDup = isDuplicate(normId, { force: item.isFavorito }, product.preco);

                    if (!isDup) {
                        // Se não for dup (ou for favorito liberado), adiciona
                        collectedProducts.push(product);
                        console.log(`   ✅ Capturado via Drive: ${product.nome}`);

                        // Marca como enviado (incluindo favoritos para valer o ciclo de 24h)
                        markAsSent([product.id]);
                    } else {
                        console.log(`   ⏭️  Skip: Duplicado no histórico.`);
                    }
                }

            } catch (err) {
                console.error(`   ❌ Erro ao processar ID ${item.id}: ${err.message}`);
            }

            // Delay suave
            await new Promise(r => setTimeout(r, 1000));
        }

    } catch (globalErr) {
        console.error('❌ Erro crítico no Scrape Drive-First:', globalErr.message);
    } finally {
        await page.close();
    }

    console.log(`🚙 DRIVE-FIRST FINALIZADO: ${collectedProducts.length} itens recuperados.\n`);
    return collectedProducts;
}

module.exports = { scrapeSpecificIds };
