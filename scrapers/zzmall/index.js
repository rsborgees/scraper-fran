const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');

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

            const product = await parseProductZZMall(page, url);
            if (product) {
                product.loja = 'zzmall';
                product.desconto = product.precoOriginal - product.precoAtual;
                products.push(product);
            }
        }

    } catch (error) {
        console.error(`Erro no scraper ZZMall: ${error.message}`);
    } finally {
        await browser.close();
    }

    console.log(`\n✅ ZZMALL: ${products.length}/${quota} produtos capturados`);

    if (products.length < quota) {
        console.warn(`⚠️ quota_not_reached: ZZMALL (${products.length}/${quota})`);
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

            // Marcas confiáveis
            const trustedBrands = ['arezzo', 'schutz', 'anacapri', 'fiever', 'vans', 'reserva'];
            const bodyText = getSafeText(document.body).toLowerCase();

            const isTrusted = trustedBrands.some(brand => bodyText.includes(brand));
            if (!isTrusted) return null;

            // Nome
            const h1 = document.querySelector('h1');
            const nome = getSafeText(h1);
            if (!nome) return null;

            // Preço original
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

            // Preço atual (DOM defensivo)
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
            if (bodyText.includes('vestido')) categoria = 'vestido';
            else if (bodyText.includes('sapato') || bodyText.includes('calçado')) categoria = 'calçado';
            else if (bodyText.includes('bolsa')) categoria = 'acessório';
            else if (bodyText.includes('blusa')) categoria = 'blusa';

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
            console.log(`✅ ZZMall: ${data.nome} | R$${data.precoOriginal}->R$${data.precoAtual}`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeZZMall };
