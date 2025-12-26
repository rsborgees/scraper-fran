const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');

const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Scraper KJU
 * URL: https://www.kjubrasil.com/?ref=7B1313
 * Quota: 6 produtos
 * Classificação: com tamanhos = roupa, sem tamanhos = acessório
 */
async function scrapeKJU(quota = 6) {
    console.log('\n💎 INICIANDO SCRAPER KJU (Quota: ' + quota + ')');

    const products = [];
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.kjubrasil.com/?ref=7B1313', {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        await page.waitForTimeout(3000);

        // Screenshot
        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: path.join(DEBUG_DIR, 'kju_list.png') });

        // Coleta URLs de produtos
        const productUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/produto"], a[href*="/p/"]'));
            return [...new Set(links.map(a => a.href).filter(url => url.includes('/p')))];
        });

        console.log(`Encontrados ${productUrls.length} produtos candidatos`);

        for (const url of productUrls) {
            if (products.length >= quota) break;

            const product = await parseProductKJU(page, url);
            if (product) {
                product.loja = 'kju';
                product.desconto = product.precoOriginal - product.precoAtual;
                products.push(product);
            }
        }

    } catch (error) {
        console.error(`Erro no scraper KJU: ${error.message}`);
    } finally {
        await browser.close();
    }

    console.log(`\n✅ KJU: ${products.length}/${quota} produtos capturados`);

    if (products.length < quota) {
        console.warn(`⚠️ quota_not_reached: KJU (${products.length}/${quota})`);
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

            // Nome
            const h1 = document.querySelector('h1');
            const nome = getSafeText(h1);
            if (!nome) return null;

            // Preço original (riscado)
            const priceOldEl = document.querySelector('s, [class*="old"], [class*="original"]');
            if (!priceOldEl) return null;

            const priceOldText = getSafeText(priceOldEl);
            const matchOld = priceOldText.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
            if (!matchOld) return null;

            let valStrOld = matchOld[1].replace(/\./g, '');
            if (valStrOld.includes(',')) {
                valStrOld = valStrOld.replace(',', '.');
            } else {
                valStrOld = valStrOld + '.00';
            }
            const precoOriginal = parseFloat(valStrOld);

            // Preço atual
            const allPrices = Array.from(document.querySelectorAll('*'))
                .filter(el => el.children.length === 0 && getSafeText(el).includes('R$'))
                .map(el => getSafeText(el));

            const realPrices = allPrices.filter(txt => !/x\s*de|parcel|sem\s+juros/i.test(txt));

            const numericPrices = [];
            realPrices.forEach(txt => {
                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '');
                    if (valStr.includes(',')) {
                        valStr = valStr.replace(',', '.');
                    } else {
                        valStr = valStr + '.00';
                    }
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0 && val < precoOriginal) {
                        numericPrices.push(val);
                    }
                }
            });

            if (numericPrices.length === 0) return null;
            const precoAtual = Math.min(...numericPrices);

            if (precoOriginal - precoAtual < 5) return null;

            // Tamanhos (para classificar)
            const sizeEls = Array.from(document.querySelectorAll('[class*="size"], [class*="tamanho"], label'));
            const sizeRegex = /^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i;
            const tamanhos = [];

            sizeEls.forEach(el => {
                const txt = getSafeText(el).toUpperCase();
                if (sizeRegex.test(txt)) {
                    const isDisabled = el.className.toLowerCase().includes('disable') ||
                        el.getAttribute('aria-disabled') === 'true';
                    if (!isDisabled && el.offsetWidth > 0) {
                        tamanhos.push(txt);
                    }
                }
            });

            // Classificação: com tamanhos = roupa, sem tamanhos = acessório
            const categoria = tamanhos.length > 0 ? 'roupa' : 'acessório';

            return {
                nome,
                precoOriginal,
                precoAtual,
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href
            };
        });

        if (data) {
            console.log(`✅ KJU: ${data.nome} | R$${data.precoOriginal}->R$${data.precoAtual} (${data.categoria})`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeKJU };
