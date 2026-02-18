const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');
const { processProductUrl, processImageDirect } = require('../../imageDownloader');
const { isDuplicate, markAsSent } = require('../../historyManager');

const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Scraper LIVE
 * URL: https://www.liveoficial.com.br/outlet
 * Quota: 6 produtos
 * Usar SOMENTE preço à vista (ignorar parcelamento)
 */
async function scrapeLive(quota = 6, ignoreDuplicates = false, parentBrowser = null) {
    console.log('\n🔵 INICIANDO SCRAPER LIVE (Quota: ' + quota + ')');

    const products = [];

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
        const targetUrl = 'https://www.liveoficial.com.br/outlet';
        console.log(`   🔗 Navegando para: ${targetUrl}`);

        await page.goto(targetUrl, {
            waitUntil: 'load',
            timeout: 60000
        });

        // Espera inicial para shields/popups renderizarem
        await page.waitForTimeout(3000 + Math.random() * 3000);

        await page.waitForTimeout(5000);

        // 🛡️ Fecha popups/modais iniciais (Refinado)
        console.log('   🛡️ Verificando popups...');
        await page.evaluate(async () => {
            const closeSelectors = [
                'button.sc-f0c9328e-3.dnwgCm',
                'button[class*="close"]',
                '.modal-close',
                'button:has(svg)',
                '[aria-label="Close"]',
                '.sc-f0c9328e-0 i',
                'div[active="true"] button'
            ];

            for (const sel of closeSelectors) {
                const els = document.querySelectorAll(sel);
                els.forEach(el => {
                    if (el && (el.offsetWidth > 0 || el.offsetHeight > 0)) {
                        el.click();
                    }
                });
            }

            const buttons = Array.from(document.querySelectorAll('button, span, a'));
            const closeBtn = buttons.find(b => {
                const t = (b.innerText || '').toLowerCase().trim();
                return t === 'x' || t === 'fechar' || t === 'close' || t === '×';
            });
            if (closeBtn) closeBtn.click();
        });
        await page.waitForTimeout(3000);

        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: path.join(DEBUG_DIR, 'live_list.png') });

        console.log('   📜 Rolando página para carregar produtos...');
        await page.evaluate(async () => {
            for (let i = 0; i < 5; i++) {
                window.scrollBy(0, 800);
                await new Promise(r => setTimeout(r, 1000));
            }
        });

        const productUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            return [...new Set(links.map(a => a.href))]
                .filter(url => {
                    try {
                        const parsed = new URL(url);
                        if (parsed.hostname !== window.location.hostname && !url.startsWith('/')) return false;
                        const path = parsed.pathname;
                        const isProductPattern = (path.endsWith('/p') || path.includes('/p/')) && path.length > 10;
                        const isExcluded = path.includes('/carrinho') || path.includes('/login') || path === '/produtos/p';
                        return isProductPattern && !isExcluded;
                    } catch (e) {
                        return false;
                    }
                });
        });

        console.log(`   🔎 Encontrados ${productUrls.length} produtos candidatos.`);
        if (productUrls.length === 0) {
            const fallbackUrls = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                return [...new Set(links.map(a => a.href))].filter(url => {
                    try {
                        const path = new URL(url).pathname;
                        return path.split('/').length >= 2 && path.length > 25 &&
                            !['/carrinho', '/login', '/checkout', '/account'].some(s => path.includes(s));
                    } catch (e) { return false; }
                });
            });
            productUrls.push(...fallbackUrls.slice(0, 20));
        }

        for (const url of productUrls) {
            if (products.length >= quota * 3) break;
            console.log(`\n   🔎 Processando: ${url}`);
            await page.waitForTimeout(1000 + Math.random() * 2000);
            const product = await parseProductLive(page, url);
            if (!product) continue;

            if (!ignoreDuplicates && isDuplicate(product.id, {}, product.preco)) {
                console.log(`   ⏭️  Duplicado (Histórico): ${product.id}`);
                continue;
            }

            product.loja = 'live';
            product.precoAtual = product.preco;
            product.precoOriginal = product.preco_original || product.preco;
            product.desconto = product.precoOriginal - product.precoAtual;
            if (product.desconto < 0) product.desconto = 0;

            products.push(product);
        }

    } catch (error) {
        console.error(`Erro no scraper Live: ${error.message}`);
    } finally {
        if (shouldCloseBrowser) {
            await browser.close();
        } else {
            if (page) await page.close();
        }
    }

    console.log(`\n🧩 Tentando formar conjuntos com ${products.length} produtos...`);
    const sets = [];
    const onePieces = [];
    const usedIndices = new Set();

    products.forEach((p, i) => {
        const nome = p.nome.toLowerCase();
        if (nome.includes('macacão') || nome.includes('vestido') || nome.includes('macaquinho') || nome.includes('body')) {
            p.type = 'onepiece';
            onePieces.push(p);
            usedIndices.add(i);
        } else if (nome.includes('top') || nome.includes('cropped') || nome.includes('sutiã') || nome.includes('blusa') || nome.includes('t-shirt') || nome.includes('regata')) {
            p.type = 'top';
        } else if (nome.includes('legging') || nome.includes('short') || nome.includes('saia') || nome.includes('bermuda') || nome.includes('calça')) {
            p.type = 'bottom';
        } else {
            p.type = 'other';
        }
    });

    const tops = products.filter((p, i) => !usedIndices.has(i) && p.type === 'top');
    const bottoms = products.filter((p, i) => !usedIndices.has(i) && p.type === 'bottom');

    for (const top of tops) {
        if (usedIndices.has(products.indexOf(top))) continue;
        const match = bottoms.find(b => !usedIndices.has(products.indexOf(b)));
        if (match) {
            sets.push(top);
            sets.push(match);
            usedIndices.add(products.indexOf(top));
            usedIndices.add(products.indexOf(match));
            console.log(`   💕 Conjunto Formado (Relaxado): ${top.nome} + ${match.nome}`);
        }
    }

    let finalSelection = [];
    finalSelection.push(...sets);
    finalSelection.push(...onePieces);

    const singles = products.filter((p, i) => !usedIndices.has(i));
    if (finalSelection.length < quota && singles.length > 0) {
        finalSelection.push(...singles);
    }

    if (finalSelection.length > quota) {
        if (sets.length >= quota) {
            finalSelection = sets.slice(0, quota);
            if (finalSelection.length % 2 !== 0 && finalSelection[finalSelection.length - 1].type !== 'onepiece') {
                finalSelection.pop();
            }
        } else {
            finalSelection = finalSelection.slice(0, quota);
        }
    }

    const output = [];
    for (const p of finalSelection.slice(0, quota)) {
        console.log(`🖼️  [Final] Baixando imagem: ${p.nome}...`);
        try {
            let imgResult;
            if (p.imageUrl) {
                imgResult = await processImageDirect(p.imageUrl, 'LIVE', p.id);
            } else {
                imgResult = await processProductUrl(p.url, p.id);
            }
            if (imgResult.status === 'success' && imgResult.cloudinary_urls?.length) {
                p.imagePath = imgResult.cloudinary_urls[0];
            }
        } catch (e) { console.error(e.message); }

        markAsSent([p.id]);
        output.push(p);
    }

    return output;
}

async function parseProductLive(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(5000); // Increased wait time for content to load

        const data = await page.evaluate(() => {
            const getSafeText = (el) => {
                if (!el) return '';
                return el.innerText ? el.innerText.trim() : el.textContent ? el.textContent.trim() : '';
            };

            // 🔍 IMPROVED PRODUCT NAME EXTRACTION
            let nome = '';
            const nameSelectors = [
                'h1.vtex-store-components-3-x-productBrand',
                'h1[class*="productName"]',
                'h1[class*="productBrand"]',
                '.vtex-store-components-3-x-productNameContainer h1',
                'h1',
                '[class*="productName"]',
                '.product-name'
            ];

            for (const selector of nameSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                    nome = getSafeText(el);
                    if (nome && nome.length > 3) break;
                }
            }

            if (!nome) {
                console.log('DEBUG: Nome não encontrado com nenhum seletor');
                return null;
            }

            console.log('DEBUG: Nome encontrado:', nome);

            // 💰 IMPROVED PRICE EXTRACTION with multiple fallbacks
            let preco = 0;
            let precoOriginal = 0;

            // Strategy 1: JSON-LD (Most reliable)
            const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const script of jsonLdScripts) {
                try {
                    const data = JSON.parse(script.innerHTML);
                    const products = Array.isArray(data) ? data : [data];
                    const product = products.find(item => item['@type'] === 'Product' || (typeof item['@type'] === 'string' && item['@type'].includes('Product')));

                    if (product && product.offers) {
                        const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
                        const validOffers = offers.filter(o => o.price && parseFloat(o.price) > 0);
                        if (validOffers.length > 0) {
                            preco = parseFloat(validOffers[0].price);
                            precoOriginal = validOffers[0].listPrice ? parseFloat(validOffers[0].listPrice) : (validOffers[0].highPrice ? parseFloat(validOffers[0].highPrice) : preco);
                            console.log('DEBUG: Preço extraído via JSON-LD:', preco);
                            break;
                        }
                    }
                } catch (e) { }
            }

            // Strategy 2: Meta tags
            if (preco === 0) {
                const metaPrice = document.querySelector('meta[property="product:price:amount"]');
                if (metaPrice && metaPrice.content) {
                    preco = parseFloat(metaPrice.content);
                    console.log('DEBUG: Preço extraído via meta tag:', preco);
                }
            }

            // Strategy 3: DOM selectors with expanded search
            if (preco === 0) {
                const priceSelectors = [
                    '.vtex-product-price-1-x-sellingPrice .vtex-product-price-1-x-sellingPriceValue',
                    '[class*="sellingPriceValue"]',
                    '.sc-79aad9d-3',
                    '.vtex-flex-layout-0-x-flexRowContent--product-main [class*="price"]',
                    '[class*="productPrice"]',
                    '.price',
                    'span[class*="bestPrice"]'
                ];

                for (const selector of priceSelectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        const text = getSafeText(el);
                        const parsed = parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.'));
                        if (!isNaN(parsed) && parsed > 0) {
                            preco = parsed;
                            console.log('DEBUG: Preço extraído via seletor DOM:', selector, preco);
                            break;
                        }
                    }
                }
            }

            // Strategy 4: Search all elements containing "R$"
            if (preco === 0) {
                const allElements = Array.from(document.querySelectorAll('span, div, b, strong, p'));
                const priceElements = allElements.filter(el => {
                    const text = getSafeText(el);
                    return text.includes('R$') && /\d/.test(text) && text.length < 30;
                });

                for (const el of priceElements) {
                    const text = getSafeText(el);
                    // Avoid installment prices
                    if (!/\d\s*x|x\s*de|parcela/i.test(text)) {
                        const parsed = parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.'));
                        if (!isNaN(parsed) && parsed > 20) {
                            preco = parsed;
                            console.log('DEBUG: Preço extraído via busca genérica:', preco);
                            break;
                        }
                    }
                }
            }

            // Extract original price (list price)
            if (precoOriginal === 0) {
                const listPriceSelectors = [
                    '[class*="listPrice"]',
                    '[class*="ListPrice"]',
                    '.sc-d49848f0-16',
                    '[class*="oldPrice"]',
                    'span[style*="line-through"]'
                ];

                for (const selector of listPriceSelectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        const parsed = parseFloat(getSafeText(el).replace(/[^\d,]/g, '').replace(',', '.'));
                        if (!isNaN(parsed) && parsed > 0) {
                            precoOriginal = parsed;
                            break;
                        }
                    }
                }
            }

            if (precoOriginal === 0 || precoOriginal < preco) {
                precoOriginal = preco;
            }

            console.log('DEBUG: Preços finais - Atual:', preco, 'Original:', precoOriginal);

            // 📏 IMPROVED SIZE EXTRACTION
            const tamanhos = [];
            const sizeSelectors = [
                '.vtex-store-components-3-x-skuSelectorItem',
                '[class*="sku-selector"] button',
                '[class*="sku-selector"] label',
                '[class*="size"] button',
                '[class*="tamanho"] button',
                'button[class*="sku"]',
                '.sku-selector-container button',
                '.sku-selector-container label'
            ];

            const sizeElements = new Set();
            sizeSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => sizeElements.add(el));
            });

            // Also check generic buttons and labels
            document.querySelectorAll('button, label, li').forEach(el => {
                const text = getSafeText(el).toUpperCase();
                if (/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/.test(text.replace(/TAMANHO|TAM|[:\n]/g, '').trim())) {
                    sizeElements.add(el);
                }
            });

            sizeElements.forEach(el => {
                let txt = getSafeText(el).toUpperCase();
                txt = txt.replace(/TAMANHO|TAM|SIZE|[:\n]/g, '').trim();

                const match = txt.match(/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i);
                if (match) {
                    const normalizedSize = match[0].toUpperCase();
                    const style = window.getComputedStyle(el);

                    // Improved disabled detection
                    const isDisabled =
                        el.disabled ||
                        el.getAttribute('disabled') === 'true' ||
                        el.getAttribute('aria-disabled') === 'true' ||
                        el.classList.contains('disabled') ||
                        el.classList.contains('unavailable') ||
                        el.classList.contains('sku-notavailable') ||
                        style.textDecoration.includes('line-through') ||
                        style.backgroundImage.includes('svg') ||
                        style.backgroundImage.includes('data:image') ||
                        (style.opacity && Number(style.opacity) < 0.5) ||
                        style.cursor === 'not-allowed' ||
                        el.className.toLowerCase().includes('disable') ||
                        el.className.toLowerCase().includes('unavailable');

                    if (!isDisabled && el.offsetWidth > 0 && el.offsetHeight > 0) {
                        tamanhos.push(normalizedSize);
                    }
                }
            });

            console.log('DEBUG: Tamanhos encontrados:', tamanhos);

            // 🚫 VALIDAÇÃO: Rejeitar roupas que só têm PP ou só têm GG (se houver PP+GG é válido)
            if (tamanhos.length > 0) {
                const uniqueSizes = [...new Set(tamanhos.map(s => s.toUpperCase().trim()))];
                const isOnlyPP = uniqueSizes.length === 1 && uniqueSizes[0] === 'PP';
                const isOnlyGG = uniqueSizes.length === 1 && uniqueSizes[0] === 'GG';

                if (isOnlyPP || isOnlyGG) {
                    return null; // Reject items with only PP or only GG
                }
            }

            // 🆔 IMPROVED ID EXTRACTION
            const refEl = document.querySelector('.vtex-product-identifier-0-x-product-identifier__value, .vtex-product-identifier, .productReference, .sku, [class*="productId"]');
            let id = refEl ? getSafeText(refEl).replace(/\D/g, '') : '';

            if (!id || id === 'unknown') {
                // Try URL patterns
                const urlMatch = window.location.href.match(/\/([A-Z]\d+[A-Z]*\d*)(\/|$|\?)/);
                if (urlMatch) {
                    id = urlMatch[1];
                } else {
                    const numMatch = window.location.href.match(/(\d{5,})/);
                    if (numMatch) id = numMatch[1];
                }
            }

            if (!id) id = 'LIVE_' + Date.now();

            console.log('DEBUG: ID extraído:', id);

            // 🖼️ IMAGE EXTRACTION
            let imageUrl = null;
            const ogImg = document.querySelector('meta[property="og:image"]');
            if (ogImg && ogImg.content) {
                imageUrl = ogImg.content;
            } else {
                const imgs = Array.from(document.querySelectorAll('img'));
                const productImg = imgs.find(img =>
                    img.src &&
                    (img.src.includes('/arquivos/') || img.src.includes('/product/')) &&
                    img.width > 200
                );
                if (productImg) imageUrl = productImg.src;
            }

            return {
                id,
                nome,
                preco,
                preco_original: precoOriginal,
                tamanhos: [...new Set(tamanhos)],
                url: window.location.href,
                imageUrl
            };
        });

        if (!data) {
            console.log(`❌ Dados não extraídos de ${url}`);
            return null;
        }

        // Validate extracted data
        if (!data.nome || data.preco === 0) {
            console.log(`⚠️ Dados incompletos: Nome="${data.nome}", Preço=${data.preco}`);
            // Still return the data, but log the warning
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeLive, parseProductLive };
