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
async function scrapeZZMall(quota = 6) {
    console.log('\n🟠 INICIANDO SCRAPER ZZMALL (Quota: ' + quota + ')');

    const products = [];
    const seenInRun = new Set();
    const { normalizeId } = require('../../historyManager');
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://zzmall.com.br?influ=cupomdafran', {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        await page.waitForTimeout(3000);

        // Screenshot
        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: path.join(DEBUG_DIR, 'zzmall_list.png') });

        // Coleta URLs de produtos
        const productUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/produto"], a[href*="/p/"]'));
            return [...new Set(links.map(a => a.href).filter(url => url.includes('/p')))];
        });

        console.log(`Encontrados ${productUrls.length} produtos candidatos`);

        for (const url of productUrls) {
            if (products.length >= quota) break;

            // Parse Product
            const product = await parseProductZZMall(page, url);

            if (product) {
                const normId = normalizeId(product.id);
                if (normId && (seenInRun.has(normId) || isDuplicate(normId))) {
                    console.log(`   ⏭️  Duplicado (Histórico/Run): ${normId}`);
                    continue;
                }

                if (normId) seenInRun.add(normId);

                // Image Download
                console.log(`🖼️  Baixando imagem com ID: ${product.id}...`);
                let imagePath = null;
                try {
                    let imgResult;
                    if (product.imageUrl) {
                        imgResult = await processImageDirect(product.imageUrl, 'ZZMALL', product.id);
                    } else {
                        imgResult = await processProductUrl(url, product.id);
                    }

                    if (imgResult.status === 'success' && imgResult.cloudinary_urls && imgResult.cloudinary_urls.length > 0) {
                        imagePath = imgResult.cloudinary_urls[0];
                        console.log(`   ✔️  Imagem salva: ${imagePath}`);
                    } else {
                        console.log(`   ⚠️  Falha download imagem: ${imgResult.reason}`);
                    }
                } catch (err) {
                    console.log(`   ❌ Erro download imagem: ${err.message}`);
                }

                // Adiciona parâmetro de influenciadora
                product.url = url.includes('?') ? `${url}&influ=cupomdafran` : `${url}?influ=cupomdafran`;

                product.loja = 'zzmall';
                product.desconto = product.precoOriginal - product.precoAtual;
                if (product.desconto < 0) product.desconto = 0;
                product.imagePath = imagePath;
                markAsSent([product.id]); // MARCA IMEDIATAMENTE
                products.push(product);

            }
        }

    } catch (error) {
        console.error(`Erro no scraper ZZMall: ${error.message}`);
    } finally {
        await browser.close();
    }

    // markAsSent já foi chamado para cada produto


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

            // Marcas confiáveis (Rigoroso: Arezzo, Schutz prioritários)
            const trustedBrands = ['arezzo', 'schutz'];
            const bodyText = getSafeText(document.body).toLowerCase();

            const isTrusted = trustedBrands.some(brand => bodyText.includes(brand));
            if (!isTrusted) return null;

            // Nome
            const h1 = document.querySelector('h1');
            const nome = getSafeText(h1);
            if (!nome) return null;

            let numericPrices = [];

            // Estratégia 1: Meta Tags (Mais confiável)
            const metaPrice = document.querySelector('meta[property="product:price:amount"], meta[itemprop="price"]');
            if (metaPrice) {
                const val = parseFloat(metaPrice.content);
                if (!isNaN(val) && val > 0) numericPrices.push(val);
            }

            // Estratégia 2: JSON-LD (Script Data)
            try {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                scripts.forEach(script => {
                    const json = JSON.parse(script.innerText);
                    if (json && (json['@type'] === 'Product' || json['@type'] === 'ProductGroup')) {
                        const offers = json.offers;
                        if (offers) {
                            const price = offers.price || offers.lowPrice || offers.highPrice;
                            if (price) numericPrices.push(parseFloat(price));
                        }
                    }
                });
            } catch (e) { }

            // Estratégia 3: Varredura visual robusta (Fallback)
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

            if (numericPrices.length === 0) return null;

            const maxVal = Math.max(...numericPrices);
            // Filtra parcelas (<30% do max)
            const valid = numericPrices.filter(v => v > (maxVal * 0.3));

            const precoOriginal = Math.max(...valid); // De
            const precoAtual = Math.min(...valid);    // Por

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

            // Categoria (Restrito a Calçados e Acessórios)
            let categoria = null;
            if (bodyText.includes('sapato') || bodyText.includes('calçado') || bodyText.includes('tênis') || bodyText.includes('rasteira') || bodyText.includes('sandália') || bodyText.includes('scarpin') || bodyText.includes('bota')) {
                categoria = 'calçado';
            } else if (bodyText.includes('bolsa') || bodyText.includes('carteira') || bodyText.includes('cinto') || bodyText.includes('acessório') || bodyText.includes('mochila')) {
                categoria = 'acessório';
            }

            // Se for roupa ou não identificado, descarta
            if (!categoria || bodyText.includes('vestido') || bodyText.includes('blusa') || bodyText.includes('calça') || bodyText.includes('regata') || bodyText.includes('macacão')) {
                return null;
            }

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
