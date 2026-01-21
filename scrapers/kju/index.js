const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');
const { processProductUrl } = require('../../imageDownloader');
const { isDuplicate, markAsSent } = require('../../historyManager');

const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Scraper KJU
 * URL: https://www.kjubrasil.com/?ref=7B1313
 * Quota: 6 produtos
 * @param {number} quota - Número máximo de produtos a retornar
 */
async function scrapeKJU(quota = 6, parentBrowser = null) {
    console.log('\n💎 INICIANDO SCRAPER KJU (Quota: ' + quota + ')');

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
        const targetUrl = 'https://www.kjubrasil.com/acessorios/?ref=7B1313';
        console.log(`   🔗 Navegando para Categorias (Acessórios): ${targetUrl}`);

        await page.goto(targetUrl, {
            waitUntil: 'load',
            timeout: 60000
        });

        // Identifica seletores de cards de produtos
        const productSelector = '.produtos .item a, .prod a, a.b_acao';

        // Espera explícita pelo container de produtos ou seletor padrão
        console.log('   ⏳ Aguardando carregamento dos produtos...');
        try {
            await page.waitForSelector(productSelector, { state: 'attached', timeout: 15000 });
        } catch (e) {
            console.warn('   ⚠️ Timeout aguardando produtos. Tentando continuar...');
        }

        // 📜 Rolagem lenta e parcial (3 viewports)
        console.log('   📜 Rolando página suavemente (parcial)...');
        await page.evaluate(async () => {
            const distance = 100;
            const delay = 400;
            const maxScrolls = 20; // Aproximadamente 2-3 telas
            for (let i = 0; i < maxScrolls; i++) {
                window.scrollBy(0, distance);
                await new Promise(r => setTimeout(r, delay));
            }
        });
        await page.waitForTimeout(2000);

        // Coleta URLs de produtos (flat structure na KJU)
        const productUrls = await page.evaluate((sel) => {
            const links = Array.from(document.querySelectorAll(sel));
            return [...new Set(links.map(a => a.href))]
                .filter(url => {
                    const path = new URL(url).pathname;
                    if (path === '/' || path === '') return false;

                    // Filtra links que parecem ser de produtos
                    const isSystem = ['/carrinho', '/checkout', '/conta', '/atendimento', '/politica', '/troca', '/ajuda', '/contato', '/quem-somos'].some(s => path.includes(s));
                    const isCategory = ['/categoria/', '/selo/', '/colecao/', '/novidades/', '/loja/', '/acessorios/'].some(s => path.includes(s));
                    const isLongEnough = path.length > 20;
                    return !isSystem && !isCategory && isLongEnough;
                });
        }, productSelector);

        // Fallback se não encontrar nada com o seletor padrão
        if (productUrls.length === 0) {
            console.log('   ⚠️ Nenhum produto encontrado com ".prod a". Tentando seletores alternativos...');
            const fallbackUrls = await page.evaluate(() => {
                // Procura por links que pareçam ser de produtos (geralmente sem extensões e com nomes longos)
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                return anchors
                    .map(a => a.href)
                    .filter(href => {
                        const path = new URL(href).pathname;
                        return path.length > 15 && !path.includes('/central/') && !path.includes('/ajuda/') && !path.includes('/fale-conosco/');
                    });
            });
            productUrls.push(...new Set(fallbackUrls));
            console.log(`   💡 Fallback encontrou ${productUrls.length} links potenciais.`);
        }

        for (const url of productUrls) {
            if (products.length >= quota) break;

            console.log(`\n🛍️  Processando produto ${products.length + 1}/${quota}: ${url}`);

            // Random delay entre produtos
            await page.waitForTimeout(1000 + Math.random() * 2000);

            const product = await parseProductKJU(page, url);

            if (product && product.nome) {
                // RESTRIÇÃO ESTRITA: KJU SÓ ACESSÓRIOS
                if (product.categoria !== 'acessório') {
                    console.log(`   ⏭️  KJU: Descartando ${product.categoria} (Solicitado apenas acessórios)`);
                    continue;
                }

                const normId = normalizeId(product.id);
                if (normId && (seenInRun.has(normId) || isDuplicate(normId))) {
                    console.log(`   ⏭️  Duplicado (Histórico/Run): ${normId}`);
                    continue;
                }

                if (normId) seenInRun.add(normId);

                // Image Download
                console.log(`   🖼️  Baixando imagem com ID: ${product.id}...`);
                let imagePath = null;
                try {
                    const imgResult = await processProductUrl(url, product.id);
                    if (imgResult && imgResult.status === 'success' && imgResult.cloudinary_urls?.length > 0) {
                        imagePath = imgResult.cloudinary_urls[0];
                    }
                } catch (err) { }

                product.url = url.includes('?') ? `${url}&ref=7B1313` : `${url}?ref=7B1313`;
                product.loja = 'kju';
                product.imagePath = imagePath;
                markAsSent([product.id]); // DISABLED FOR TESTING
                products.push(product);
            }

            // Volta para a lista
            await page.goto('https://www.kjubrasil.com/acessorios/?ref=7B1313', { waitUntil: 'load' });
            await page.evaluate(() => window.scrollBy(0, 800));
            await page.waitForTimeout(1000);
        }

    } catch (error) {
        console.error(`❌ Erro no scraper KJU: ${error.message}`);
    } finally {
        if (shouldCloseBrowser) {
            await browser.close();
        } else {
            if (page) await page.close();
        }
    }

    return products;
}

async function parseProductKJU(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        const data = await page.evaluate(() => {
            const getSafeText = (el) => {
                if (!el) return '';
                const txt = el.innerText || el.textContent || '';
                return (typeof txt === 'string') ? txt.trim() : '';
            };

            const h1 = document.querySelector('h1');
            let nome = getSafeText(h1);
            if (!nome) return null;

            nome = nome.replace(/^Comprar\s+/i, '')
                .replace(/\s*-\s*Loja KJU.*$/i, '')
                .trim();

            let container = document.querySelector('.detalhes') || document.querySelector('.produto-info') || document.querySelector('.info') || document.querySelector('#product-container') || document.body;

            // Strategy: Find explicit prices first
            let precoOriginal = null;
            let precoAtual = null;

            // 1. Try to find explicit "old price" (De ...)
            const oldPriceEl = container.querySelector('.old-price, .price-old, .preco-de, .valor_de, del, s, .strikethrough');
            if (oldPriceEl) {
                const txt = getSafeText(oldPriceEl);
                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    precoOriginal = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                }
            }

            // 2. Find all potential prices for Current Price (Por ...)
            // We exclude elements that look like installments or totals

            // PRIORITY: Check for specific Tray Commerce structure first
            // This avoids issues where the price is near installment text and gets discarded by the aggressive filter
            // Structure 1: .valor .valor_final span (seen in some products)
            // Structure 2: .valores .valor span (seen in others, where .valor matches parent of span)
            const specificPriceEl = container.querySelector('.valor .valor_final span, .valor .valor_final, .valores .valor span, .detalhes .price span');

            if (specificPriceEl) {
                const txt = getSafeText(specificPriceEl);
                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                    if (!isNaN(val) && val > 0) {
                        precoAtual = val;
                        // If we found the specific reliable price, we can skip the heuristic search
                    }
                }
            } else {
                // No specific selector found, proceed with heuristic search
            }

            if (!precoAtual) {
                const priceElements = Array.from(container.querySelectorAll('.valor, .price, .current-price, .preco-por, .preco-venda, .special-price, span, div, strong, b'));
                const potentialPrices = [];

                priceElements.forEach(el => {
                    const txt = getSafeText(el);
                    if (!txt.includes('R$')) return;

                    // Stronger exclusions
                    // Exclude multi-installment, fees, credit specific strings, but ALLOW "1x de" as it is usually the cash price
                    const parentTxt = el.parentElement ? getSafeText(el.parentElement) : '';
                    const grandParentTxt = (el.parentElement && el.parentElement.parentElement) ? getSafeText(el.parentElement.parentElement) : '';
                    const combinedTxt = txt + ' ' + parentTxt + ' ' + grandParentTxt;

                    // Regex matches "2x" through "12x" (and more), plus keywords like "juros" (unless it is "sem juros" attached to 1x, which is tricky).
                    // Easier: Exclude "Xx de" where X > 1. 
                    // Exclude "pix", "boleto", "vista".

                    if (/(?<!1)x\s*de|parcel|crédito|total|pix|boleto|vista/i.test(combinedTxt)) {
                        // Lookbehind (?<!1) checks that 'x' is NOT preceded by '1'. So "1x" matches nothing (OK), "2x" matches (Excluded).
                        // However, JS lookbehind support is good in Node 16+. 
                        // Safe alternative: check for specific [2-9]x or \d{2}x
                        return;
                    }

                    // If it mentions "juros" but NOT "1x", exclude.
                    if (/juros/i.test(combinedTxt) && !/1x/i.test(combinedTxt)) {
                        return;
                    }

                    // Avoid using the "De" price as a "Por" price candidate if possible
                    if (el === oldPriceEl || (oldPriceEl && oldPriceEl.contains(el))) return;

                    const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                    if (match) {
                        let valStr = match[1].replace(/\./g, '').replace(',', '.');
                        const val = parseFloat(valStr);
                        console.log(`   Candidate Price: ${val} (Source: ${el.tagName}.${el.className})`);
                        if (!isNaN(val) && val > 0) potentialPrices.push(val);
                    }
                });

                if (potentialPrices.length > 0) {
                    // If we found explicitly old price, current is likely the min of others
                    // If we didn't find explicitly old price, current is also likely min (cash price)
                    // But we strictly DO NOT invent an old price from the max unless it was found in step 1.
                    precoAtual = Math.min(...potentialPrices);

                    // Sanity check: if original is lower than current, invalidate original
                    if (precoOriginal !== null && precoOriginal <= precoAtual) {
                        precoOriginal = null;
                    }
                }
            }

            if (!precoAtual) {
                return null; // No price found
            }

            // Tamanhos
            const sizeEls = Array.from(document.querySelectorAll('[class*="size"], [class*="tamanho"], button, li, label'));
            const tamanhos = [];
            sizeEls.forEach(el => {
                let txt = getSafeText(el).toUpperCase().replace(/TAMANHO|TAM|[:\n]/g, '').trim();
                const match = txt.match(/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i);
                if (match) {
                    const normalizedSize = match[0].toUpperCase();
                    const isDisabled = el.className.toLowerCase().includes('disable') || el.className.toLowerCase().includes('unavailable') || el.classList.contains('indisponivel');
                    if (!isDisabled && (el.offsetWidth > 0 || el.offsetHeight > 0)) {
                        tamanhos.push(normalizedSize);
                    }
                }
            });

            const categoria = tamanhos.length > 0 ? 'roupa' : 'acessório';

            let id = 'unknown';
            const specificIdEl = document.querySelector('.codigo_produto, [itemprop="identifier"], .productReference');
            if (specificIdEl) {
                const text = getSafeText(specificIdEl);
                const match = text.match(/\d+/);
                if (match) id = match[0];
            }

            if (id === 'unknown' && h1) {
                let current = h1.nextElementSibling;
                for (let i = 0; i < 5 && current; i++) {
                    const text = getSafeText(current);
                    const match = text.match(/\d+/);
                    if (match && match[0].length >= 4) {
                        id = match[0];
                        break;
                    }
                    current = current.nextElementSibling;
                }
            }

            // --- DESCONTO EXTRA DE 10% EM PEÇAS SEM PROMOÇÃO (Regra Vendedora) ---
            if (precoAtual > 0 && (!precoOriginal || precoOriginal <= precoAtual)) {
                precoOriginal = precoAtual; // Define o original como o preço cheio
                const precoComDescontoExtra = parseFloat((precoAtual * 0.90).toFixed(2));
                console.log(`🎉 [PROMO KJU] Aplicando 10% off (Vendedora): De R$${precoAtual} para R$${precoComDescontoExtra}`);
                precoAtual = precoComDescontoExtra;
            }
            // ---------------------------------------------------------------------

            return {
                id,
                nome,
                precoAtual: precoAtual,
                precoOriginal: precoOriginal, // Agora garantido ter o preço cheio se houve desconto
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href
            };
        });

        if (data) {
            console.log(`✅ KJU: ${data.nome} | R$${data.precoAtual}${data.precoOriginal > data.precoAtual ? ' (Promo de R$' + data.precoOriginal + ')' : ''}`);
        }
        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeKJU, parseProductKJU };
