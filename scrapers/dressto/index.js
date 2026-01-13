const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');
const { processProductUrl, processImageDirect } = require('../../imageDownloader');
const { isDuplicate, markAsSent } = require('../../historyManager');
const { parseProductDressTo } = require('./parser');

const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Scraper DRESS TO
 * URL: https://www.dressto.com.br/nossas-novidades
 * Quota: 18 produtos (80% vestidos, 20% macacões)
 */
async function scrapeDressTo(quota = 18, parentBrowser = null) {
    console.log('\n👗 INICIANDO SCRAPER DRESS TO (Quota: ' + quota + ')');

    const products = [];
    const seenInRun = new Set();
    const { normalizeId } = require('../../historyManager');

    let browser, page;
    let shouldCloseBrowser = false;

    if (parentBrowser) {
        browser = parentBrowser;
        page = await browser.newPage();
    } else {
        ({ browser, page } = await initBrowser());
        shouldCloseBrowser = true;
    }

    try {
        let pageNum = 1;
        let consecEmptyPages = 0;
        const maxPages = 5; // Suficiente para preencher a quota de Dress To

        while (products.length < quota && pageNum <= maxPages) {
            const currentUrl = `https://www.dressto.com.br/nossas-novidades?page=${pageNum}`;
            console.log(`   📄 Página ${pageNum}: ${currentUrl}`);

            try {
                await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                // Explicit wait for any product link to ensure page is actually ready
                try {
                    await page.waitForSelector('a.vtex-product-summary-2-x-clearLink, a[href$="/p"]', { timeout: 15000 });
                } catch (e) { console.log('      ⚠️ Timeout esperando carregamento da lista (tentando continuar mesmo assim)...'); }

                await page.waitForTimeout(3000);

                // Scroll suave para carregar lazy elements (VTEX IO)
                await page.evaluate(async () => {
                    window.scrollBy(0, 800);
                    await new Promise(r => setTimeout(r, 1000));
                    window.scrollBy(0, 800);
                });

                // Coleta URLs de produtos
                const productUrls = await page.evaluate(() => {
                    const sel = 'a.vtex-product-summary-2-x-clearLink, a[href$="/p"], a[href*="/p?"]';
                    const links = Array.from(document.querySelectorAll(sel));
                    return [...new Set(links.map(a => a.href))]
                        .filter(url => {
                            const parsed = new URL(url);
                            return parsed.pathname.endsWith('/p') || parsed.pathname.includes('/p/');
                        });
                });

                if (productUrls.length === 0) {
                    console.log('      ⚠️ Nenhum produto encontrado nesta página.');
                    consecEmptyPages++;
                    if (consecEmptyPages >= 3) break;
                } else {
                    consecEmptyPages = 0;
                    console.log(`      🔎 Analisando ${productUrls.length} produtos na página ${pageNum}...`);

                    // Priorização de URLs por keyword
                    productUrls.sort((a, b) => {
                        const score = (url) => {
                            const lower = url.toLowerCase();
                            if (lower.includes('vestido')) return 2;
                            if (lower.includes('macacao') || lower.includes('macacão')) return 2;
                            return 0;
                        };
                        return score(b) - score(a);
                    });

                    let collectedVestidos = products.filter(p => p.categoria === 'vestido').length;
                    let collectedMacacoes = products.filter(p => p.categoria === 'macacão').length;

                    for (const url of productUrls) {
                        // Stop strictly when quota is reached
                        if (products.length >= quota) break;

                        // Check ID na URL
                        // Procura padrão de 8 dígitos que pode estar separado por pontos ou hífens
                        // Ex: 01.33.2394 ou 01-33-2394
                        const idMatch = url.match(/(\d{2})[.-]?(\d{2})[.-]?(\d{4})/);
                        if (idMatch) {
                            const earlyId = normalizeId(idMatch[1] + idMatch[2] + idMatch[3]);
                            if (earlyId && (seenInRun.has(earlyId) || isDuplicate(earlyId))) continue;
                        }

                        // Parse Product
                        const product = await parseProductDressTo(page, url);

                        if (product) {
                            const normId = normalizeId(product.id);
                            if (normId && (seenInRun.has(normId) || isDuplicate(normId))) continue;

                            if (normId) seenInRun.add(normId);

                            if (normId) seenInRun.add(normId);

                            // Image Download
                            console.log(`      🖼️  Baixando imagem ${product.id}...`);
                            let imagePath = null;
                            try {
                                const imgResult = product.imageUrl ?
                                    await processImageDirect(product.imageUrl, 'DRESSTO', product.id) :
                                    await processProductUrl(url, product.id);
                                if (imgResult?.status === 'success' && imgResult.cloudinary_urls?.length) {
                                    imagePath = imgResult.cloudinary_urls[0];
                                }
                            } catch (err) { }

                            product.loja = 'dressto';
                            product.desconto = 0;
                            product.imagePath = imagePath || 'error.jpg';
                            markAsSent([product.id]);
                            products.push(product);

                            if (product.categoria === 'vestido') collectedVestidos++;
                            if (product.categoria === 'macacão') collectedMacacoes++;

                            console.log(`      ✅ [${products.length}/${quota}] Capturado: ${product.nome} (${product.categoria})`);
                        }
                    }
                }
            } catch (errPage) {
                console.log(`      ⚠️ Erro ao acessar página ${pageNum}: ${errPage.message}`);
                consecEmptyPages++;
            }
            pageNum++;
        }
    } catch (error) {
        console.error(`Erro no scraper Dress To: ${error.message}`);
    } finally {
        if (shouldCloseBrowser) {
            await browser.close();
        } else {
            if (page) await page.close();
        }
    }

    // Aplicar cotas internas (65% vestido, 15% macacão, 5% saia, 5% short, 5% blusa, 5% acessório)
    // Aplicar cotas internas (Regra "1 macacão e 1 vestido" se quota permitir)
    const byCategory = {};
    products.forEach(p => {
        const cat = p.categoria || 'outros';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(p);
    });

    const selectedProducts = [];
    const usedIds = new Set();

    // 1. Garante 1 Macacão
    if (byCategory['macacão'] && byCategory['macacão'].length > 0) {
        const item = byCategory['macacão'][0];
        selectedProducts.push(item);
        usedIds.add(item.id);
    }

    // 2. Garante 1 Vestido
    if (byCategory['vestido'] && byCategory['vestido'].length > 0) {
        // Pega o primeiro que não foi usado
        const item = byCategory['vestido'].find(p => !usedIds.has(p.id));
        if (item) {
            selectedProducts.push(item);
            usedIds.add(item.id);
        }
    }

    // 3. Preenche o restante da quota seguindo distribuição padrão ou aleatória
    if (selectedProducts.length < quota) {
        // Se a quota for maior que 2 (ex: 18), precisamos preencher
        // Se for exata (2), e já pegamos 1+1, ok.
        // Se faltar algum (ex: não achou macacão), precisamos completar com qualquer coisa.

        const remainingQuota = quota - selectedProducts.length;
        const pool = products.filter(p => !usedIds.has(p.id));

        // Prioridade para Vestidos depois Macacões depois o resto
        // Ordena pool: Vestido > Macacão > Outros
        pool.sort((a, b) => {
            const score = (c) => c.categoria === 'vestido' ? 3 : (c.categoria === 'macacão' ? 2 : 1);
            return score(b) - score(a);
        });

        selectedProducts.push(...pool.slice(0, remainingQuota));
    }

    // Ordenação final no output? Não necessário.

    console.log(`\n✅ Dress To Selecionados (${selectedProducts.length}):`);
    selectedProducts.forEach(p => console.log(`   - ${p.nome} (${p.categoria}) | R$${p.precoAtual}`));

    return selectedProducts.slice(0, quota);
}

module.exports = { scrapeDressTo };
