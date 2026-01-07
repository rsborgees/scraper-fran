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
        await page.goto('https://www.dressto.com.br/nossas-novidades', {
            waitUntil: 'load',
            timeout: 60000
        });

        await page.waitForTimeout(3000);

        // 📜 Rolagem lenta e parcial (simulando humano)
        console.log('   📜 Rolando página suavemente (parcial)...');
        try {
            await page.evaluate(async () => {
                const distance = 150;
                const delay = 350;
                const maxScrolls = 15;
                for (let i = 0; i < maxScrolls; i++) {
                    window.scrollBy(0, distance);
                    await new Promise(r => setTimeout(r, delay));
                }
            });
        } catch (e) {
            console.warn(`   ⚠️ Erro durante rolagem (contexto destruído?), continuando...`);
        }
        await page.waitForTimeout(2000);

        // Coleta URLs de produtos (Dress To usa estrutura VTEX onde links de produtos terminam em /p)
        const productSelector = 'a.vtex-product-summary-2-x-clearLink, a[href$="/p"]';
        const productUrls = await page.evaluate((sel) => {
            const links = Array.from(document.querySelectorAll(sel));
            return [...new Set(links.map(a => a.href))]
                .filter(url => {
                    const path = new URL(url).pathname;
                    return path.endsWith('/p') && path.length > 20;
                });
        }, productSelector);

        console.log(`   🔎 Encontrados ${productUrls.length} produtos na listagem.`);

        for (const url of productUrls) {
            // Coletamos margem para categorias
            if (products.length >= (quota * 2)) break;

            console.log(`\n🛍️  Processando produto ${products.length + 1}/${quota}: ${url}`);

            // Interação opcional ou navegação direta
            try {
                const relativePath = new URL(url).pathname;
                const element = await page.$(`a[href*="${relativePath}"]`);
                if (element) {
                    await element.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(500);
                    try {
                        await element.click({ force: true, timeout: 5000 });
                    } catch (e) {
                        await page.evaluate((el) => el.click(), element);
                    }
                    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
                } else {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                }
            } catch (err) {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            }

            // 1. Parse Product
            const product = await parseProductDressTo(page, url);

            if (product) {
                const normId = normalizeId(product.id);

                if (normId && (seenInRun.has(normId) || isDuplicate(normId))) {
                    console.log(`   ⏭️  Duplicado (Histórico/Run): ${normId}`);
                    continue;
                }

                if (normId) seenInRun.add(normId);

                // 2. Image Download
                console.log(`   🖼️  Baixando imagem com ID: ${product.id}...`);
                let imagePath = null;
                try {
                    let imgResult;
                    if (product.imageUrl) {
                        imgResult = await processImageDirect(product.imageUrl, 'DRESSTO', product.id);
                    } else {
                        imgResult = await processProductUrl(url, product.id);
                    }
                    if (imgResult && imgResult.status === 'success' && imgResult.cloudinary_urls?.length > 0) {
                        imagePath = imgResult.cloudinary_urls[0];
                    }
                } catch (err) { }

                product.loja = 'dressto';
                product.desconto = 0;
                product.imagePath = imagePath;
                markAsSent([product.id]); // MARCA IMEDIATAMENTE
                products.push(product);

            }

            // Volta para a lista
            await page.goto('https://www.dressto.com.br/nossas-novidades', { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => window.scrollBy(0, 800));
            await page.waitForTimeout(1000);
        }

    } catch (error) {
        console.error(`Erro no scraper Dress To: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Aplicar cotas internas (65% vestido, 15% macacão, 5% saia, 5% short, 5% blusa, 5% acessório)
    const quotas = {
        'vestido': Math.round(quota * 0.65),
        'macacão': Math.round(quota * 0.15),
        'saia': Math.max(1, Math.round(quota * 0.05)),
        'short': Math.max(1, Math.round(quota * 0.05)),
        'blusa': Math.max(1, Math.round(quota * 0.05)),
        'acessório': Math.max(1, Math.round(quota * 0.05))
    };

    const byCategory = {};
    products.forEach(p => {
        const cat = p.categoria || 'outros';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(p);
    });

    const selectedProducts = [];
    Object.keys(quotas).forEach(cat => {
        const available = byCategory[cat] || [];
        const catQuota = quotas[cat];
        selectedProducts.push(...available.slice(0, catQuota));
    });

    // Fallback se não atingiu a quota total
    if (selectedProducts.length < quota) {
        const remainingQuota = quota - selectedProducts.length;
        const alreadySelectedIds = new Set(selectedProducts.map(p => normalizeId(p.id)));
        const pool = products.filter(p => !alreadySelectedIds.has(normalizeId(p.id)));
        selectedProducts.push(...pool.slice(0, remainingQuota));
    }

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
