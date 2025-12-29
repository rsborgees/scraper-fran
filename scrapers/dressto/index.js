const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');
const { processProductUrl } = require('../../imageDownloader');

const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Scraper DRESS TO
 * URL: https://www.dressto.com.br/nossas-novidades
 * Quota: 18 produtos (80% vestidos, 20% macacões)
 */
async function scrapeDressTo(quota = 18) {
    console.log('\n👗 INICIANDO SCRAPER DRESS TO (Quota: ' + quota + ')');

    const products = [];
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.dressto.com.br/nossas-novidades', {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        await page.waitForTimeout(3000);

        // Screenshot
        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: path.join(DEBUG_DIR, 'dressto_list.png') });

        // Coleta URLs de produtos
        const productUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/produto/"]'));
            return [...new Set(links.map(a => a.href))];
        });

        console.log(`Encontrados ${productUrls.length} produtos candidatos`);

        for (const url of productUrls) {
            if (products.length >= quota) break;

            // 1. Image Download Integration
            console.log(`🖼️  Baixando imagem...`);
            let imagePath = null;
            try {
                const imgResult = await processProductUrl(url);
                if (imgResult.status === 'success' && imgResult.path.length > 0) {
                    imagePath = imgResult.path[0];
                    console.log(`   ✔️  Imagem salva: ${imagePath}`);
                } else {
                    console.log(`   ⚠️  Falha download imagem: ${imgResult.reason}`);
                }
            } catch (err) {
                console.log(`   ❌ Erro download imagem: ${err.message}`);
            }

            // 2. Parse Product
            const product = await parseProductDressTo(page, url);
            if (product) {
                product.loja = 'dressto';
                product.desconto = 0; // Explicitly 0 as requested (no promo)
                product.imagePath = imagePath;
                products.push(product);
            }
        }

    } catch (error) {
        console.error(`Erro no scraper Dress To: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Aplicar prioridade: 80% vestidos, 20% macacões
    const vestidos = products.filter(p => p.categoria === 'vestido');
    const macacoes = products.filter(p => p.categoria === 'macacão');
    const outros = products.filter(p => p.categoria !== 'vestido' && p.categoria !== 'macacão');

    const vestidosQuota = Math.floor(quota * 0.8);
    const macacoesQuota = Math.floor(quota * 0.2);

    const selected = [
        ...vestidos.slice(0, vestidosQuota),
        ...macacoes.slice(0, macacoesQuota)
    ];

    console.log(`\n✅ DRESS TO: ${selected.length}/${quota} produtos capturados`);

    if (selected.length < quota) {
        console.warn(`⚠️ quota_not_reached: DRESS TO (${selected.length}/${quota})`);
    }

    return selected;
}

async function parseProductDressTo(page, url) {
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

            // Preço Original SOMENTE (ignorar promoções)
            // Tenta pegar o preço principal exibido. Se tiver 'old', ignora e pega o 'old' como original? 
            // "Capture APENAS o preço original exibido na página" -> Geralmente o maior valor se houver riscado, ou o único valor.
            // DressTo markup: <s>Original</s> ... Current. Or just Current.

            // Strategy: Get all prices, max price is likely original.
            const allPrices = Array.from(document.querySelectorAll('*'))
                .filter(el => el.children.length === 0 && getSafeText(el).includes('R$'))
                .map(el => getSafeText(el));

            const realPrices = allPrices.filter(txt => !/x\s*de|parcel|sem\s+juros/i.test(txt));
            const numericPrices = [];

            realPrices.forEach(txt => {
                const match = txt.match(/R\$\s*([\d\.]+,\d{2})/);
                if (match) {
                    const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                    if (!isNaN(val) && val > 0) numericPrices.push(val);
                }
            });

            if (numericPrices.length === 0) return null;

            // "Capture apenas o preço original" => Assuming this means the List Price.
            // If there's a discount, List Price is Max. If no discount, Max == Min.
            // So grabbing MAX price is safest to satisfy "Original Price".
            const precoOriginal = Math.max(...numericPrices);
            const precoAtual = precoOriginal; // Force same price (no promo logic)

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

            if (tamanhos.length === 0) return null;

            // Categoria
            let categoria = 'outros';
            const bodyText = getSafeText(document.body).toLowerCase();
            if (bodyText.includes('vestido')) categoria = 'vestido';
            else if (bodyText.includes('macacão') || bodyText.includes('macaquinho')) categoria = 'macacão';

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
            console.log(`✅ Dress To: ${data.nome} | R$${data.precoOriginal}->R$${data.precoAtual}`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeDressTo };
