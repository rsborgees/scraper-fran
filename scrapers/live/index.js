const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');

const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Scraper LIVE
 * URL: https://www.liveoficial.com.br/novidades
 * Quota: 6 produtos
 * Usar SOMENTE preço à vista (ignorar parcelamento)
 */
async function scrapeLive(quota = 6) {
    console.log('\n🔵 INICIANDO SCRAPER LIVE (Quota: ' + quota + ')');

    const products = [];
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.liveoficial.com.br/novidades', {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        await page.waitForTimeout(3000);

        // Screenshot
        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: path.join(DEBUG_DIR, 'live_list.png') });

        // Coleta URLs de produtos
        const productUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/produto"], a[href*="/p/"]'));
            return [...new Set(links.map(a => a.href).filter(url => url.includes('/p')))];
        });

        console.log(`Encontrados ${productUrls.length} produtos candidatos`);

        for (const url of productUrls) {
            if (products.length >= quota) break;

            const product = await parseProductLive(page, url);
            if (product) {
                product.loja = 'live';
                product.desconto = product.precoOriginal - product.precoAtual;
                products.push(product);
            }
        }

    } catch (error) {
        console.error(`Erro no scraper Live: ${error.message}`);
    } finally {
        await browser.close();
    }

    console.log(`\n✅ LIVE: ${products.length}/${quota} produtos capturados`);

    if (products.length < quota) {
        console.warn(`⚠️ quota_not_reached: LIVE (${products.length}/${quota})`);
    }

    return products;
}

async function parseProductLive(page, url) {
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

            // Preço original
            const priceOldEl = document.querySelector('s, [class*="old"], [class*="de:"]');
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

            // Preço à vista (ignorar parcelamento e "/")
            const allPrices = Array.from(document.querySelectorAll('*'))
                .filter(el => el.children.length === 0 && getSafeText(el).includes('R$'))
                .map(el => getSafeText(el));

            // Filtro ESTRITO: sem "x de", sem "/", sem "parcel"
            const realPrices = allPrices.filter(txt => {
                return !/x\s*de|\/|parcel|sem\s+juros/i.test(txt);
            });

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

            // Tamanhos
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

            // Categoria
            let categoria = 'outros';
            const bodyText = getSafeText(document.body).toLowerCase();
            if (bodyText.includes('vestido')) categoria = 'vestido';
            else if (bodyText.includes('macacão')) categoria = 'macacão';
            else if (bodyText.includes('blusa')) categoria = 'blusa';
            else if (bodyText.includes('calça')) categoria = 'calça';

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
            console.log(`✅ Live: ${data.nome} | R$${data.precoOriginal}->R$${data.precoAtual}`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeLive };
