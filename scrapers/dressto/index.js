const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');
const { processProductUrl, processImageDirect } = require('../../imageDownloader');
const { isDuplicate, markAsSent } = require('../../historyManager');

const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Scraper DRESS TO
 * URL: https://www.dressto.com.br/nossas-novidades
 * Quota: 18 produtos (80% vestidos, 20% macacões)
 */
async function scrapeDressTo(quota = 18) {
    console.log('\n👗 INICIANDO SCRAPER DRESS TO (Quota: ' + quota + ')');

    const products = [];
    const seenInRun = new Set();
    const { normalizeId } = require('../../historyManager');
    const { browser, page } = await initBrowser();

    try {
        let pageNum = 1;
        let consecEmptyPages = 0;
        const maxPages = 5; // Suficiente para preencher a quota de Dress To

        while (products.length < quota && pageNum <= maxPages) {
            const currentUrl = `https://www.dressto.com.br/nossas-novidades?page=${pageNum}`;
            console.log(`   📄 Página ${pageNum}: ${currentUrl}`);

            try {
                await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
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
                        // Critério de Parada Inteligente Check
                        // Se quota for pequena (<=2), persegue 1 de cada.
                        const isStrict = quota <= 3;
                        if (isStrict) {
                            if (collectedVestidos >= 1 && collectedMacacoes >= 1 && products.length >= quota) break;
                        } else {
                            if (products.length >= quota) break;
                        }

                        // Check ID na URL
                        const idMatch = url.match(/(\d{6,})/);
                        if (idMatch) {
                            const earlyId = normalizeId(idMatch[1]);
                            if (earlyId && (seenInRun.has(earlyId) || isDuplicate(earlyId))) continue;
                        }

                        // Parse Product
                        const product = await parseProductDressTo(page, url);

                        if (product) {
                            const normId = normalizeId(product.id);
                            if (normId && (seenInRun.has(normId) || isDuplicate(normId))) continue;

                            if (normId) seenInRun.add(normId);

                            // Validar categoria se Strict Mode
                            if (isStrict) {
                                // Se já temos vestido e este é vestido, skip? Não, excesso é bom pra garantir.
                                // Mas se faltam apenas macacões, e isso é uma blusa, podemos pular para economizar?
                                // Por enquanto, aceita tudo, filtramos no final.
                            }

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
        await browser.close();
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

async function parseProductDressTo(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Espera de estabilização extra para sites VTEX pesados
        await page.waitForTimeout(4000);

        const data = await page.evaluate(() => {
            const getSafeText = (el) => {
                if (!el) return '';
                const txt = el.innerText || el.textContent || '';
                return (typeof txt === 'string') ? txt.trim() : '';
            };

            // Nome
            const h1 = document.querySelector('h1');
            const nome = getSafeText(h1);
            if (!nome) return null;

            // Preço Original SOMENTE (ignorar promoções)
            // Tenta pegar o preço principal exibido. Se tiver 'old', ignora e pega o 'old' como original? 
            // "Capture APENAS o preço original exibido na página" -> Geralmente o maior valor se houver riscado, ou o único valor.
            // DressTo markup: <s>Original</s> ... Current. Or just Current.

            // 1. Coleta todos os preços visíveis
            const allPrices = Array.from(document.querySelectorAll('*'))
                .filter(el => el.children.length === 0 && getSafeText(el).includes('R$'))
                .map(el => getSafeText(el));

            const realPrices = allPrices.filter(txt => !/x\s*de|parcel|sem\s+juros/i.test(txt));
            let numericPrices = [];

            realPrices.forEach(txt => {
                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '');
                    if (valStr.includes(',')) valStr = valStr.replace(',', '.');
                    else valStr = valStr + '.00';
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0) numericPrices.push(val);
                }
            });

            if (numericPrices.length === 0) return null;

            // 2. Filtra valores de parcelas (geralmente menores que 30% do maior valor)
            const maxVal = Math.max(...numericPrices);
            const validPrices = numericPrices.filter(p => p > (maxVal * 0.3));

            // 3. Define Preço Original e Atual
            const precoOriginal = Math.max(...validPrices);
            const precoAtual = Math.min(...validPrices);

            const preco = precoAtual;

            // Tamanhos
            const sizeEls = Array.from(document.querySelectorAll('[class*="size"], [class*="tamanho"], button, li, label'));
            const tamanhos = [];

            sizeEls.forEach(el => {
                let txt = getSafeText(el).toUpperCase();
                // Limpeza: "TAMANHO P" -> "P", "TAM: 38" -> "38"
                txt = txt.replace(/TAMANHO|TAM|[:\n]/g, '').trim();

                const match = txt.match(/^(PP|P|M|G|GG|UN|ÚNICO)$/i);
                if (match) {
                    const normalizedSize = match[0].toUpperCase();
                    const isDisabled = el.className.toLowerCase().includes('disable') ||
                        el.className.toLowerCase().includes('unavailable') ||
                        el.getAttribute('aria-disabled') === 'true';
                    if (!isDisabled && (el.offsetWidth > 0 || el.offsetHeight > 0)) {
                        tamanhos.push(normalizedSize);
                    }
                }
            });

            if (tamanhos.length === 0) return null;

            // Categoria (INFERÊNCIA MAIS PRECISA)
            let categoria = 'outros';
            const pageTitle = (document.title || '').toLowerCase();
            const breadcrumb = getSafeText(document.querySelector('.vtex-breadcrumb-1-x-container')).toLowerCase();
            const fullText = (pageTitle + ' ' + breadcrumb + ' ' + nome.toLowerCase());

            if (fullText.includes('vestido')) categoria = 'vestido';
            else if (fullText.includes('macacão') || fullText.includes('macaquinho')) categoria = 'macacão';
            else if (fullText.includes('saia')) categoria = 'saia';
            else if (fullText.includes('short')) categoria = 'short';
            else if (fullText.includes('blusa') || fullText.includes('top') || fullText.includes('camisa') || fullText.includes('regata')) categoria = 'blusa';
            else if (fullText.includes('brinco') || fullText.includes('bolsa') || fullText.includes('colar') || fullText.includes('cinto') || fullText.includes('acessório')) categoria = 'acessório';
            else if (fullText.includes('calça')) categoria = 'calça';

            // ID (Referência VTEX)
            let id = 'unknown';
            const refEl = document.querySelector('.vtex-product-identifier, .vtex-product-identifier--product-reference');
            if (refEl) {
                // Formato esperado: 01.33.2394_198 -> Queremos 01332394
                let rawText = getSafeText(refEl);
                if (rawText.includes('_')) {
                    rawText = rawText.split('_')[0];
                }
                id = rawText.replace(/\D/g, '');
            }

            if (id === 'unknown' || id.length < 6) {
                // Fallback para URL se o ID extraído for inválido ou muito curto
                // Tenta achar padrão de 8 digitos na URL também
                // Ex: .../vestido-longo-01332394/p
                const urlMatch = window.location.href.match(/(\d{7,})/);
                if (urlMatch) id = urlMatch[1];
            }

            return {
                id,
                nome,
                precoAtual: precoAtual,
                precoOriginal: precoOriginal,
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href,
                imageUrl: (function () {
                    const gallerySelectors = [
                        '.vtex-store-components-3-x-productImageTag',
                        '.product-image',
                        '.image-gallery img',
                        'img[data-zoom]'
                    ];

                    let candidates = [];
                    for (const sel of gallerySelectors) {
                        const els = document.querySelectorAll(sel);
                        if (els.length > 0) candidates.push(...Array.from(els));
                    }
                    if (candidates.length === 0) {
                        candidates = Array.from(document.querySelectorAll('img'))
                            .filter(img => img.width > 250 && img.height > 250);
                    }
                    if (candidates.length === 0) {
                        const ogImg = document.querySelector('meta[property="og:image"]');
                        if (ogImg && ogImg.content) return ogImg.content;
                    }

                    const bestImg = candidates.find(img => (img.currentSrc || img.src) && !(img.src || '').includes('svg'));
                    return bestImg ? (bestImg.currentSrc || bestImg.src) : null;
                })()
            };
        });

        if (data) {
            console.log(`✅ Dress To: ${data.nome} | R$${data.precoAtual}`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeDressTo, parseProductDressTo };
