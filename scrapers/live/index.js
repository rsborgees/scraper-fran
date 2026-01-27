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
        await page.waitForTimeout(4000);

        const data = await page.evaluate(() => {
            const getSafeText = (el) => {
                if (!el) return '';
                return el.innerText ? el.innerText.trim() : el.textContent ? el.textContent.trim() : '';
            };

            const nomeEl = document.querySelector('h1, [class*="productName"], .vtex-store-components-3-x-productBrand, .productName');
            const nome = getSafeText(nomeEl);

            if (!nome) {
                console.log('DEBUG: Nome não encontrado');
                return null;
            }

            // 1. Extração de Preço via JSON-LD (Mais confiável)
            let preco = 0;
            let precoOriginal = 0;

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
                            break;
                        }
                    }
                } catch (e) { }
            }

            // Fallback para UI
            if (preco === 0) {
                const mainContainer = document.querySelector('.vtex-flex-layout-0-x-flexRowContent--product-main, .vtex-product-details-1-x-container') || document;
                const sellingPriceEl = mainContainer.querySelector('[class*="sellingPriceValue"], .sc-79aad9d-3');
                const listPriceEl = mainContainer.querySelector('[class*="listPrice"], [class*="ListPrice"], .sc-d49848f0-16');

                if (sellingPriceEl) {
                    preco = parseFloat(getSafeText(sellingPriceEl).replace(/[^\d,]/g, '').replace(',', '.'));
                }
                if (listPriceEl) {
                    precoOriginal = parseFloat(getSafeText(listPriceEl).replace(/[^\d,]/g, '').replace(',', '.'));
                } else {
                    precoOriginal = preco;
                }
            }

            // Tamanhos
            const sizeEls = Array.from(document.querySelectorAll('[class*="sku-selector"], [class*="size"], [class*="tamanho"], button, li, label'));
            const tamanhos = [];

            sizeEls.forEach(el => {
                let txt = getSafeText(el).toUpperCase();
                txt = txt.replace(/TAMANHO|TAM|[:\n]/g, '').trim();

                const match = txt.match(/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i);
                if (match) {
                    const normalizedSize = match[0].toUpperCase();
                    const style = window.getComputedStyle(el);

                    const isCrossedOut = style.textDecoration.includes('line-through') ||
                        style.backgroundImage.includes('svg') ||
                        style.backgroundImage.includes('data:image') ||
                        (style.opacity && Number(style.opacity) < 0.6) ||
                        el.className.toLowerCase().includes('disable') ||
                        el.className.toLowerCase().includes('unavailable') ||
                        el.getAttribute('aria-disabled') === 'true';

                    if (!isCrossedOut && el.offsetWidth > 0) {
                        tamanhos.push(normalizedSize);
                    }
                }
            });

            const refEl = document.querySelector('.vtex-product-identifier, .productReference, .sku');
            let id = refEl ? getSafeText(refEl).replace(/\D/g, '') : 'unknown';

            if (id === 'unknown' || id === '') {
                const urlMatch = window.location.href.match(/(\d+)(AZ|00|BC|[\-\/])/);
                if (urlMatch) id = urlMatch[1];
                else {
                    const longNumMatch = window.location.href.match(/(\d{5,})/);
                    if (longNumMatch) id = longNumMatch[1];
                }
            }

            return {
                id,
                nome,
                preco,
                preco_original: precoOriginal || preco,
                tamanhos: [...new Set(tamanhos)],
                url: window.location.href,
                imageUrl: (function () {
                    const ogImg = document.querySelector('meta[property="og:image"]');
                    if (ogImg && ogImg.content) return ogImg.content;
                    const imgs = Array.from(document.querySelectorAll('img'));
                    const productImg = imgs.find(img => img.src && img.src.includes('/product/') && img.width > 200);
                    return productImg ? productImg.src : null;
                })()
            };
        });

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeLive, parseProductLive };
