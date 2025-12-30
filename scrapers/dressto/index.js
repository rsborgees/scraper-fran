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

        // 📜 Rolagem lenta e parcial (simulando humano)
        console.log('   📜 Rolando página suavemente (parcial)...');
        await page.evaluate(async () => {
            const distance = 150;
            const delay = 350;
            const maxScrolls = 15;
            for (let i = 0; i < maxScrolls; i++) {
                window.scrollBy(0, distance);
                await new Promise(r => setTimeout(r, delay));
            }
        });
        await page.waitForTimeout(2000);

        // Coleta URLs de produtos (Dress To usa estrutura VTEX onde links de produtos terminam em /p)
        const productSelector = 'a.vtex-product-summary-2-x-clearLink, a[href$="/p"]';
        const productUrls = await page.evaluate((sel) => {
            const links = Array.from(document.querySelectorAll(sel));
            return [...new Set(links.map(a => a.href))]
                .filter(url => {
                    const path = new URL(url).pathname;
                    // Links de produtos na Dress To terminam em /p e costumam ter o nome do produto no path
                    return path.endsWith('/p') && path.length > 20;
                });
        }, productSelector);

        console.log(`   🔎 Encontrados ${productUrls.length} produtos na listagem.`);

        for (const url of productUrls) {
            // Coletamos o dobro da quota para ter margem de manobra nas categorias
            if (products.length >= (quota * 2)) break;

            console.log(`\n🛍️  Processando produto ${products.length + 1}/${quota}: ${url}`);

            // Simula o clique/interação
            try {
                const relativePath = new URL(url).pathname;
                // Busca o link específico para clicar
                const element = await page.$(`a[href*="${relativePath}"]`);
                if (element) {
                    console.log(`   🖱️  Clicando no elemento do produto...`);
                    await element.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(500);
                    await element.click();
                    // Espera carregar a página do produto
                    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
                } else {
                    console.log(`   🔗 Elemento não encontrado diretamente, navegando via URL...`);
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                }
            } catch (err) {
                console.log(`   ⚠️ Falha na interação: ${err.message}`);
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            }

            // 1. Parse Product PRIMEIRO para ter o ID
            const product = await parseProductDressTo(page, url);

            if (product) {
                // 2. Image Download Integration (usando o ID já extraído)
                console.log(`   🖼️  Baixando imagem com ID: ${product.id}...`);
                let imagePath = null;
                try {
                    const imgResult = await processProductUrl(url, product.id);
                    if (imgResult && imgResult.status === 'success' && imgResult.cloudinary_urls && imgResult.cloudinary_urls.length > 0) {
                        imagePath = imgResult.cloudinary_urls[0];
                        console.log(`      ✔️  Imagem salva: ${imagePath}`);
                    }
                } catch (err) {
                    console.log(`      ❌ Erro imagem: ${err.message}`);
                }

                product.loja = 'dressto';
                product.desconto = 0;
                product.imagePath = imagePath;
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

    // Aplicar prioridade: 80% vestidos, 20% macacões (ou preencher com o que houver)
    const vestidos = products.filter(p => p.categoria === 'vestido');
    const macacoes = products.filter(p => p.categoria === 'macacão');
    const outros = products.filter(p => p.categoria !== 'vestido' && p.categoria !== 'macacão');

    const vestidosQuota = Math.round(quota * 0.8);
    const macacoesQuota = Math.round(quota * 0.2);

    let selected = [
        ...vestidos.slice(0, vestidosQuota),
        ...macacoes.slice(0, macacoesQuota)
    ];

    // Se as categorias prioritárias não preencherem a quota total, pega do 'outros'
    if (selected.length < quota) {
        const gap = quota - selected.length;
        selected = [...selected, ...outros.slice(0, gap)];
    }

    console.log(`\n✅ DRESS TO: ${selected.length}/${quota} produtos capturados`);

    if (selected.length < quota) {
        console.warn(`⚠️ quota_not_reached: DRESS TO (${selected.length}/${quota})`);
    }

    return selected.slice(0, quota);
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
            // Apenas UM preço (o máximo encontrado)
            const preco = Math.max(...numericPrices);

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

            // Categoria (INFERÊNCIA MAIS PRECISA)
            let categoria = 'outros';
            const pageTitle = (document.title || '').toLowerCase();
            const breadcrumb = getSafeText(document.querySelector('.vtex-breadcrumb-1-x-container')).toLowerCase();
            const fullText = (pageTitle + ' ' + breadcrumb + ' ' + nome.toLowerCase());

            if (fullText.includes('vestido')) categoria = 'vestido';
            else if (fullText.includes('macacão') || fullText.includes('macaquinho')) categoria = 'macacão';
            else if (fullText.includes('saia')) categoria = 'saia';
            else if (fullText.includes('short')) categoria = 'short';
            else if (fullText.includes('blusa') || fullText.includes('top') || fullText.includes('camisa')) categoria = 'blusa';
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
                preco,
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href
            };
        });

        if (data) {
            console.log(`✅ Dress To: ${data.nome} | R$${data.preco}`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeDressTo };
