const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');
const { processProductUrl, processImageDirect } = require('../../imageDownloader');
const { isDuplicate, markAsSent } = require('../../historyManager');

const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Scraper ZZMALL
 * URL: https://zzmall.com.br?influ=cupomdafran
 * Quota: 6 produtos
 * Filtrar por marcas confiáveis (Arezzo, Schutz, etc)
 */
async function scrapeZZMall(quota = 6, parentBrowser = null) {
    console.log('\n🟠 INICIANDO SCRAPER ZZMALL (Quota: ' + quota + ')');

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
        // URL da página de promoções
        const promoUrl = 'https://www.zzmall.com.br/c/promocao';

        console.log(`   💎 Visitando página de PROMOÇÕES: ${promoUrl}`);

        try {
            await page.goto(promoUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForTimeout(3000); // Espera maior para VTEX carregar

            // Fecha popups (Genérico)
            try {
                await page.evaluate(() => {
                    const closers = document.querySelectorAll('.modal-close, button[aria-label="Close"], [class*="close"]');
                    closers.forEach(b => b.click());
                });
            } catch (e) { }

            // Scroll para carregar mais produtos
            console.log('      📜 Rolando página para carregar produtos...');
            try {
                await page.waitForSelector('a[href*="/p/"]', { timeout: 10000 });
            } catch (e) {
                console.log('      ⚠️ Timeout esperando produtos. Tentando rolar mesmo assim...');
            }

            await page.evaluate(async () => {
                for (let i = 0; i < 30; i++) { // Scroll profundo
                    window.scrollBy(0, 1000);
                    await new Promise(r => setTimeout(r, 600));
                }
            });

            // Coleta URLs de produtos
            const productUrls = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a'));
                return [...new Set(anchors
                    .map(a => a.href)
                    .filter(url => {
                        if (!url) return false;
                        const isProd = (url.includes('/p/') || url.includes('/produto/'));
                        const isExcluded = url.includes('login') || url.includes('cart') || url.includes('checkout');
                        return isProd && !isExcluded;
                    })
                )];
            });

            console.log(`      🔎 Encontrados ${productUrls.length} produtos em promoção`);

            // Processa produtos
            for (const url of productUrls) {
                if (products.length >= quota) break;

                console.log(`      🔎 Analisando: ${url}`);
                const product = await parseProductZZMall(page, url);

                if (product) {
                    // FILTER: ZZMall - NO CLOTHES (ONLY SHOES/BAGS)
                    const normalizedCat = product.categoria ? product.categoria.toLowerCase() : '';
                    const productNomeLower = product.nome.toLowerCase();

                    // List of terms that definitely indicate clothing - EXPANDED
                    const clothingTerms = [
                        'vestido', 'blusa', 'casaco', 'saia', 'short', 'macacão', 'macacao', 'top',
                        'biquíni', 'biquini', 'body', 'camisa', 'jaqueta', 'blazer', 'pantalo',
                        'regata', 't-shirt', 'tshirt', 'tricot', 'tricô', 'camiseta', 'bermuda',
                        'moletom', 'cardigan', 'kimono', 'chemise', 'macaquinho', 'parka', 'colete',
                        'pijama', 'lingerie', 'cueca', 'calcinha', 'sutiã', 'sutia', 'meia',
                        'legging', 'fitness', 'sunga', 'bata', 'túnica', 'tunica', 'tricô', 'malha',
                        'suéter', 'sueter', 'pullover', 'sobretudo', 'trench', 'corset', 'corselet'
                    ];

                    // Refined exclusion: Use word boundaries to avoid matching "calçado" for "calça"
                    const hasCalca = /\bcalça\b/i.test(normalizedCat) || /\bcalça\b/i.test(productNomeLower);

                    // Check clothing terms with word boundaries
                    const matchedClothingTerm = clothingTerms.find(term => {
                        const regex = new RegExp(`\\b${term}\\b`, 'i');
                        return regex.test(normalizedCat) || regex.test(productNomeLower);
                    });

                    let isCloth = !!matchedClothingTerm || hasCalca || normalizedCat === 'roupa';

                    // Safety: IF it's explicitly categorized as shoe or bag, don't ignore it as cloth
                    if (normalizedCat === 'calçado' || normalizedCat === 'bolsa') {
                        isCloth = false;
                    }

                    if (isCloth) {
                        console.log(`      ⛔ Ignorado (Roupa detectada): ${product.nome} (${product.categoria})`);
                        continue;
                    }

                    const normId = normalizeId(product.id);
                    if (normId && (seenInRun.has(normId) || isDuplicate(normId))) {
                        console.log(`      ⏭️  Duplicado (Histórico/Run): ${normId}`);
                        continue;
                    }

                    if (normId) seenInRun.add(normId);

                    // Image Download
                    console.log(`      🖼️  Baixando imagem com ID: ${product.id}...`);
                    let imagePath = null;
                    try {
                        let imgResult;
                        if (product.imageUrl) {
                            imgResult = await processImageDirect(product.imageUrl, 'ZZMALL', product.id);
                        } else {
                            imgResult = await processProductUrl(url, product.id);
                        }

                        if (imgResult.status === 'success' && imgResult.cloudinary_urls?.length > 0) {
                            imagePath = imgResult.cloudinary_urls[0];
                        }
                    } catch (err) {
                        console.log(`      ❌ Erro download imagem: ${err.message}`);
                    }

                    product.url = url.includes('?') ? `${url}&influ=cupomdafran` : `${url}?influ=cupomdafran`;
                    product.loja = 'zzmall';
                    product.desconto = product.precoOriginal - product.precoAtual;
                    if (product.desconto < 0) product.desconto = 0;
                    product.imagePath = imagePath;

                    markAsSent([product.id]);
                    products.push(product);
                    console.log(`      ✅ Coletado: ${product.nome} | R$${product.precoAtual}`);
                }
            }


        } catch (errPromo) {
            console.log(`      ❌ Erro ao processar página de promoções: ${errPromo.message}`);
        }

    } catch (error) {
        console.error(`Erro no scraper ZZMall: ${error.message}`);
    } finally {
        if (shouldCloseBrowser) {
            await browser.close();
        } else {
            if (page) await page.close();
        }
    }

    return products;
}

async function parseProductZZMall(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        const data = await page.evaluate(() => {
            const getSafeText = (el) => {
                if (!el) return '';
                const txt = el.innerText || el.textContent || '';
                return (typeof txt === 'string') ? txt.trim() : '';
            };

            // NÃO DESCARTA MAIS POR MARCA (Confiamos nas marcas visitadas na lista brandLinks)
            const bodyText = getSafeText(document.body).toLowerCase();
            const isTrusted = true;

            // Nome
            const h1 = document.querySelector('h1');
            const nome = getSafeText(h1);
            if (!nome) return null;

            // CHECK OUT OF STOCK
            if (
                bodyText.includes('avise-me quando chegar') ||
                bodyText.includes('produto indisponível') ||
                bodyText.includes('não disponível') ||
                document.querySelector('.vtex-store-components-3-x-availability-message-neutral') ||
                document.querySelector('[class*="unavailable"]')
            ) {
                // Only return null if NO available sizes are found later? 
                // Actually, usually these messages mean ALL sizes are gone.
                // Let's check for specific "buy button" absence or "notify me" presence
                const buyButton = document.querySelector('[data-testid="ta-product-buy-button"], .buy-button, button.vtex-add-to-cart-button-0-x-button');
                if (!buyButton || bodyText.includes('avise-me')) return null;
            }

            let precoOriginal = 0;
            let precoAtual = 0;

            // Estratégia 1: Seletores Específicos ZZMall (Mais Robusto)
            const oldPriceEl = document.querySelector('[data-testid="ta-product-price"], .price--old-price');
            const newPriceEl = document.querySelector('[data-testid="ta-product-price-now"], .price--new-price');

            if (oldPriceEl && newPriceEl) {
                const oldTxt = getSafeText(oldPriceEl).replace(/\./g, '').replace(',', '.').match(/[\d.]+/);
                const newTxt = getSafeText(newPriceEl).replace(/\./g, '').replace(',', '.').match(/[\d.]+/);

                if (oldTxt && newTxt) {
                    precoOriginal = parseFloat(oldTxt[0]);
                    precoAtual = parseFloat(newTxt[0]);
                }
            }

            // Se ainda não temos preços, tenta Meta Tags ou JSON-LD ou Varredura
            if (!precoAtual) {
                let numericPrices = [];

                // Meta Tags
                const metaPrice = document.querySelector('meta[property="product:price:amount"], meta[itemprop="price"]');
                if (metaPrice) {
                    const val = parseFloat(metaPrice.content);
                    if (!isNaN(val) && val > 0) numericPrices.push(val);
                }

                // JSON-LD
                try {
                    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                    scripts.forEach(script => {
                        const json = JSON.parse(script.innerText);
                        if (json && (json['@type'] === 'Product' || json['@type'] === 'ProductGroup')) {
                            const offers = Array.isArray(json.offers) ? json.offers[0] : json.offers;
                            if (offers) {
                                const price = offers.price || offers.lowPrice || offers.highPrice;
                                if (price) numericPrices.push(parseFloat(price));
                            }
                        }
                    });
                } catch (e) { }

                // Varredura visual robusta (Fallback)
                const allElements = Array.from(document.querySelectorAll('.price, .ns-product-price, .vtex-product-price-1-x-sellingPrice, span, strong'));
                allElements.forEach(el => {
                    const txt = getSafeText(el);
                    if (txt.includes('R$') && !/x\s*de|parcel|juros/i.test(txt)) {
                        const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                        if (match) {
                            let valStr = match[1].replace(/\./g, '').replace(',', '.');
                            const val = parseFloat(valStr);
                            if (!isNaN(val) && val > 0) numericPrices.push(val);
                        }
                    }
                });

                if (numericPrices.length > 0) {
                    const maxVal = Math.max(...numericPrices);
                    const valid = numericPrices.filter(v => v > (maxVal * 0.3));
                    precoOriginal = Math.max(...valid);
                    precoAtual = Math.min(...valid);
                }
            }

            if (!precoAtual) return null;
            const preco = precoAtual;

            // Tamanhos
            const sizeEls = Array.from(document.querySelectorAll('[class*="size"], [class*="tamanho"], button, li, label'));
            const tamanhos = [];

            sizeEls.forEach(el => {
                let txt = getSafeText(el).toUpperCase();
                // Limpeza: "TAMANHO P" -> "P", "TAM: 38" -> "38"
                txt = txt.replace(/TAMANHO|TAM|[:\n]/g, '').trim();

                const match = txt.match(/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i);
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
            const uniqueTamanhos = [...new Set(tamanhos)];

            // 🚫 VALIDAÇÃO: Rejeitar roupas que só têm PP ou só têm GG (se houver PP+GG é válido)
            if (uniqueTamanhos.length > 0) {
                const normalizedSizes = uniqueTamanhos.map(s => s.toUpperCase().trim());
                const isOnlyPP = normalizedSizes.length === 1 && normalizedSizes[0] === 'PP';
                const isOnlyGG = normalizedSizes.length === 1 && normalizedSizes[0] === 'GG';

                // Only reject if it's clearly clothing (not shoes/bags)
                const isClothing = normalizedSizes.some(s => ['PP', 'P', 'M', 'G', 'GG'].includes(s));
                if (isClothing && (isOnlyPP || isOnlyGG)) {
                    return null; // Reject clothing items with only PP or only GG
                }
            }

            // Categoria (Improved detection via dataLayer or Breadcrumbs)
            let categoria = 'outros';

            // Try dataLayer first (VTEX standard)
            const dataLayer = window.dataLayer || [];
            const productEvent = dataLayer.find(item => item.productProperty && item.productProperty.productItem);
            let fullCategory = '';

            if (productEvent && productEvent.productProperty.productItem.length > 0) {
                fullCategory = (productEvent.productProperty.productItem[0].category || '').toLowerCase();
            } else {
                // Fallback to breadcrumbs (avoiding footer)
                const breadcrumbContainer = document.querySelector('.product__breadcrumbs--container, .breadcrumb-list, .vtex-breadcrumb-1-x-container');
                if (breadcrumbContainer) {
                    fullCategory = breadcrumbContainer.innerText.toLowerCase();
                }
            }

            if (fullCategory) {
                if (fullCategory.includes('sapato') || fullCategory.includes('calçado') || fullCategory.includes('tênis') || fullCategory.includes('bota') || fullCategory.includes('scarpin') || fullCategory.includes('rasteira') || fullCategory.includes('sapatilha') || fullCategory.includes('sandália') || fullCategory.includes('sandalia')) {
                    categoria = 'calçado';
                } else if (fullCategory.includes('bolsa') || fullCategory.includes('mochila') || fullCategory.includes('carteira') || fullCategory.includes('clutch') || fullCategory.includes('mala')) {
                    categoria = 'bolsa';
                } else if (fullCategory.includes('roupas') || fullCategory.includes('vestuário') || fullCategory.includes('clothing') || fullCategory.includes('moda') || fullCategory.includes('vestuario')) {
                    categoria = 'roupa';
                } else if (fullCategory.includes('vestido')) {
                    categoria = 'vestido';
                } else if (fullCategory.includes('calça') || fullCategory.includes('jeans')) {
                    categoria = 'calça';
                } else if (fullCategory.includes('blusa') || fullCategory.includes('top') || fullCategory.includes('camisa') || fullCategory.includes('camiseta') || fullCategory.includes('t-shirt') || fullCategory.includes('polo')) {
                    categoria = 'blusa';
                } else if (fullCategory.includes('casaco') || fullCategory.includes('jaqueta') || fullCategory.includes('blazer')) {
                    categoria = 'casaco';
                }
            }

            // NÃO DESCARTA MAIS ROUPAS
            // if (!categoria || ...) { return null } -> REMOVIDO

            // ID
            let id = 'unknown';
            const refEl = document.querySelector('.vtex-product-identifier, .productReference');
            if (refEl) {
                id = getSafeText(refEl).replace(/\D/g, '');
            } else {
                const urlMatch = window.location.href.match(/(\d{6,})/);
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
                    // ZZMall / Arezzo Corp usually uses these classes
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

                    const ogImg = document.querySelector('meta[property="og:image"]');
                    if (candidates.length === 0 && ogImg && ogImg.content) return ogImg.content;

                    const bestImg = candidates.find(img => (img.currentSrc || img.src) && !(img.src || '').includes('svg'));
                    return bestImg ? (bestImg.currentSrc || bestImg.src) : (ogImg ? ogImg.content : null);
                })()
            };
        });

        if (data) {
            console.log(`✅ ZZMall: ${data.nome} | R$${data.precoAtual}`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeZZMall, parseProductZZMall };
