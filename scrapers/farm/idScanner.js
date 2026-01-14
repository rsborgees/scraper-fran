const { parseProduct } = require('./parser');
const { appendQueryParams } = require('../../urlUtils');
const { normalizeId, isDuplicate, markAsSent } = require('../../historyManager');

/**
 * Scraper focado em IDs específicos (vindos do Drive)
 * @param {object} browser Playwright Browser instance
 * @param {Array} driveItems Lista de objetos { id, driveUrl, isFavorito, ... }
 */
async function scrapeSpecificIds(contextOrBrowser, driveItems, quota = 999) {
    console.log(`\n🚙 INICIANDO SCRAPE DRIVE-FIRST (${driveItems.length} itens disponíveis, meta: ${quota})...`);

    const page = await contextOrBrowser.newPage();
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

            const idsToSearch = item.ids || [item.id];
            console.log(`\n🔍 Buscendo ${item.isSet ? 'CONJUNTO' : 'ID'} ${idsToSearch.join(' ')} (Favorito: ${item.isFavorito})...`);

            const mergedProducts = [];

            for (const id of idsToSearch) {
                try {
                    console.log(`   🔎 Buscando sub-item ${id}...`);
                    // 1. Navega para a home e realiza busca interativa
                    await page.goto(`https://www.farmrio.com.br`, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    try {
                        const searchIconSelector = 'label[aria-label="open search"], .vtex-store-components-3-x-searchIcon';
                        await page.waitForSelector(searchIconSelector, { timeout: 10000 });
                        await page.click(searchIconSelector);

                        const searchInputSelector = 'input.search-input, input[placeholder*="buscar"]';
                        await page.waitForSelector(searchInputSelector, { state: 'visible', timeout: 5000 });
                        await page.fill(searchInputSelector, id);
                        await page.press(searchInputSelector, 'Enter');

                        await page.waitForTimeout(2000);
                        const notFound = await page.evaluate(() => {
                            const bodyText = document.body.innerText || '';
                            return bodyText.includes('Ops, sua busca não foi encontrada') || bodyText.includes('OPS, NÃO ENCONTRAMOS');
                        });

                        if (notFound) {
                            console.log(`      ⚠️ ID ${id} não encontrado.`);
                            continue;
                        }

                        const productLinkSelector = 'a[aria-label="view product"], .vtex-product-summary-2-x-clearLink, .shelf-product-item a';
                        await page.waitForSelector(productLinkSelector, { timeout: 15000 });
                        await new Promise(r => setTimeout(r, 1000));

                        const productLink = page.locator(productLinkSelector).first();
                        await productLink.scrollIntoViewIfNeeded();
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
                            productLink.click({ force: true })
                        ]);

                    } catch (searchErr) {
                        console.log(`      ❌ Erro na busca interativa para ${id}: ${searchErr.message}`);
                        continue;
                    }

                    const url = page.url();
                    if (!url.includes('/p') && !url.includes('/produto')) {
                        console.log(`      ❌ Redirecionamento falhou para ${id}`);
                        continue;
                    }

                    const product = await parseProduct(page, url);
                    if (product) {
                        mergedProducts.push(product);
                    }

                } catch (err) {
                    console.error(`      ❌ Erro ao processar sub-item ${id}: ${err.message}`);
                }

                await new Promise(r => setTimeout(r, 1000));
            }

            if (mergedProducts.length > 0) {
                let finalProduct;

                if (mergedProducts.length > 1) {
                    // MERGE LOGIC (CONJUNTO COMPLETO)
                    console.log(`   🔗 Consolidando conjunto completo com ${mergedProducts.length} itens. Usará foto do Drive.`);
                    finalProduct = {
                        ...mergedProducts[0],
                        id: mergedProducts.map(p => p.id).join('_'),
                        nome: mergedProducts.map(p => p.nome).join(' + '),
                        precoAtual: parseFloat(mergedProducts.reduce((sum, p) => sum + p.precoAtual, 0).toFixed(2)),
                        precoOriginal: parseFloat(mergedProducts.reduce((sum, p) => sum + (p.precoOriginal || p.precoAtual), 0).toFixed(2)),
                        isSet: true
                    };
                } else {
                    // SINGLE ITEM (pode ser parte de um conjunto que não foi encontrado completo)
                    finalProduct = mergedProducts[0];
                    if (item.isSet && idsToSearch.length > 1) {
                        console.log(`   ⚠️ Conjunto parcial: apenas 1 de ${idsToSearch.length} itens encontrado. Enviando com foto do Drive.`);
                    }
                }

                // 3. IMAGE LOGIC (Drive Priority)
                if (item.driveUrl && item.driveUrl.includes('drive.google.com')) {
                    finalProduct.imageUrl = item.driveUrl;
                    finalProduct.imagePath = item.driveUrl;
                    console.log(`      🖼️  Usando imagem do Drive.`);
                } else {
                    console.log(`      ⚠️  Imagem do Drive ausente. Mantendo original.`);
                    finalProduct.imagePath = finalProduct.imagePath || 'error.jpg';
                }

                finalProduct.favorito = item.isFavorito || false;
                finalProduct.url = appendQueryParams(finalProduct.url, { utm_campaign: "7B1313" });
                finalProduct.loja = 'farm';

                const isDup = isDuplicate(normalizeId(finalProduct.id), { force: item.isFavorito }, finalProduct.preco);

                if (!isDup) {
                    collectedProducts.push(finalProduct);
                    console.log(`   ✅ Capturado: ${finalProduct.nome}`);

                    // Marca TODOS os IDs originais como enviados
                    const allIds = mergedProducts.map(p => p.id);
                    markAsSent(allIds);
                    if (mergedProducts.length > 1) markAsSent([finalProduct.id]); // Também marca o ID composto
                } else {
                    console.log(`   ⏭️  Skip: Duplicado no histórico.`);
                }
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
