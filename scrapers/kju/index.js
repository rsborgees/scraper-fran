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
async function scrapeKJU(quota = 6) {
    console.log('\n💎 INICIANDO SCRAPER KJU (Quota: ' + quota + ')');

    const products = [];
    const seenInRun = new Set();
    const { normalizeId } = require('../../historyManager');
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.kjubrasil.com/?ref=7B1313', {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        await page.waitForTimeout(3000);

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

        // Identifica seletores de cards de produtos
        const productSelector = '.prod a';

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

        console.log(`   🔎 Encontrados ${productUrls.length} produtos na listagem.`);

        for (const url of productUrls) {
            if (products.length >= quota) break;

            console.log(`\n🛍️  Processando produto ${products.length + 1}/${quota}: ${url}`);

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
                markAsSent([product.id]);
                products.push(product);
            }

            // Volta para a lista
            await page.goto('https://www.kjubrasil.com/?ref=7B1313', { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => window.scrollBy(0, 800));
            await page.waitForTimeout(1000);
        }

    } catch (error) {
        console.error(`❌ Erro no scraper KJU: ${error.message}`);
    } finally {
        await browser.close();
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

            let container = document.querySelector('.produto-info') || document.querySelector('.info') || document.querySelector('#product-container') || document.body;
            const priceElements = Array.from(container.querySelectorAll('.price, .current-price, .old-price, span, div, strong, b'));
            const numericPrices = [];

            priceElements.forEach(el => {
                const txt = getSafeText(el);
                if (!txt.includes('R$') || /x\s*de|parcel|juros/i.test(txt)) return;
                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '').replace(',', '.');
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0) numericPrices.push(val);
                }
            });

            if (numericPrices.length === 0) return null;
            const uniquePrices = [...new Set(numericPrices)];
            let candidatePrices = uniquePrices.length > 3 ? uniquePrices.slice(0, 3) : uniquePrices;
            const maxP = Math.max(...candidatePrices);
            const validP = candidatePrices.filter(p => p > (maxP * 0.3));

            const precoOriginal = Math.max(...validP);
            const precoAtual = Math.min(...validP);

            // Tamanhos
            const sizeEls = Array.from(document.querySelectorAll('[class*="size"], [class*="tamanho"], button, li, label'));
            const tamanhos = [];
            sizeEls.forEach(el => {
                let txt = getSafeText(el).toUpperCase().replace(/TAMANHO|TAM|[:\n]/g, '').trim();
                const match = txt.match(/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i);
                if (match) {
                    const normalizedSize = match[0].toUpperCase();
                    const isDisabled = el.className.toLowerCase().includes('disable') || el.className.toLowerCase().includes('unavailable');
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

            return {
                id,
                nome,
                precoAtual: precoAtual,
                precoOriginal: precoOriginal,
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href
            };
        });

        if (data) {
            console.log(`✅ KJU: ${data.nome} | R$${data.precoAtual} (${data.categoria})`);
        }
        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeKJU, parseProductKJU };
