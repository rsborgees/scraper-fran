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

        // Screenshot DEBUG
        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: path.join(DEBUG_DIR, 'kju_list_refined.png') });

        // Identifica seletores de cards de produtos
        const productSelector = '.prod a';

        // Coleta URLs de produtos (flat structure na KJU)
        const productUrls = await page.evaluate((sel) => {
            const links = Array.from(document.querySelectorAll(sel));
            return [...new Set(links.map(a => a.href))]
                .filter(url => {
                    const path = new URL(url).pathname;
                    if (path === '/' || path === '') return false;

                    // Filtra links que parecem ser de produtos (longos e sem palavras de sistema/categoria)
                    const isSystem = ['/carrinho', '/checkout', '/conta', '/atendimento', '/politica', '/troca', '/ajuda', '/contato', '/quem-somos'].some(s => path.includes(s));
                    const isCategory = ['/categoria/', '/selo/', '/colecao/', '/novidades/', '/loja/', '/acessorios/'].some(s => path.includes(s));
                    const isLongEnough = path.length > 20; // Produtos reais têm nomes descritivos longos
                    return !isSystem && !isCategory && isLongEnough;
                });
        }, productSelector);

        console.log(`   🔎 Encontrados ${productUrls.length} produtos na listagem.`);

        for (const url of productUrls) {
            if (products.length >= quota) break;

            console.log(`\n🛍️  Processando produto ${products.length + 1}/${quota}: ${url}`);

            // Simula o clique/interação
            try {
                const relativePath = new URL(url).pathname;
                const element = await page.$(`.prod a[href*="${relativePath}"]`);
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

            // Parse Product PRIMEIRO para garantir que estamos na página certa
            const product = await parseProductKJU(page, url);

            if (product && product.nome && !product.nome.includes('LANÇAMENTO')) {
                if (isDuplicate(product.id)) {
                    console.log(`   ⏭️  Duplicado (Histórico): ${product.id}`);
                    continue;
                }

                // Image Download Integration (usando o ID já extraído)
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

                // Adiciona parâmetro de vendedora
                product.url = url.includes('?') ? `${url}&ref=7B1313` : `${url}?ref=7B1313`;

                product.loja = 'kju';

                // Calcula desconto se houver preço original
                if (product.preco_original && product.preco_original > product.preco) {
                    product.desconto = Math.round(((product.preco_original - product.preco) / product.preco_original) * 100);
                } else {
                    product.desconto = 0;
                }

                product.imagePath = imagePath;
                products.push(product);
            }

            // Volta para a lista
            await page.goto('https://www.kjubrasil.com/?ref=7B1313', { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => window.scrollBy(0, 800));
            await page.waitForTimeout(1000);
        }

    } catch (error) {
        console.error(`Erro no scraper KJU: ${error.message}`);
    } finally {
        await browser.close();
    }

    if (products.length > 0) {
        markAsSent(products.map(p => p.id));
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

            // Nome (Limpeza: remove "Comprar" e a parte "Loja KJU")
            const h1 = document.querySelector('h1');
            let nome = getSafeText(h1);
            if (!nome) return null;

            nome = nome.replace(/^Comprar\s+/i, '')
                .replace(/\s*-\s*Loja KJU.*$/i, '')
                .trim();

            // Preço (Estratégia Robusta v2)
            // Tenta focar no container do produto principal para evitar preços de "aproveite também"
            let container = document.querySelector('.produto-info') || document.querySelector('.info') || document.querySelector('#product-container') || document.body;

            const priceElements = Array.from(container.querySelectorAll('.price, .current-price, .old-price, span, div, strong, b'));

            const numericPrices = [];

            priceElements.forEach(el => {
                const txt = getSafeText(el);
                if (!txt.includes('R$')) return;

                // Ignora textos de parcelamento (ex: "3x de")
                if (/x\s*de|parcel|juros/i.test(txt)) return;

                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '');
                    valStr = valStr.replace(',', '.');
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0) numericPrices.push(val);
                }
            });

            if (numericPrices.length === 0) return null;

            // Remove duplicatas exatas
            const uniquePrices = [...new Set(numericPrices)];

            // Se houver muitos preços diferentes (> 3), perigo de pegar cross-sell.
            // Os preços do produto principal costumam aparecer primeiro no DOM.
            // Vamos pegar apenas os primeiros candidatos.
            let candidatePrices = uniquePrices;
            if (uniquePrices.length > 3) {
                candidatePrices = uniquePrices.slice(0, 3);
            }

            const maxP = Math.max(...candidatePrices);
            const validP = candidatePrices.filter(p => p > (maxP * 0.3));

            const precoOriginal = Math.max(...validP);
            const precoAtual = Math.min(...validP);

            const preco = precoAtual;
            const preco_original = precoOriginal;

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

            // Deduplicação final
            const uniqueTamanhos = [...new Set(tamanhos)];

            // Classificação: com tamanhos = roupa, sem tamanhos = acessório
            const categoria = tamanhos.length > 0 ? 'roupa' : 'acessório';

            // ID (Extração refinada: números logo abaixo do nome)
            let id = 'unknown';

            // Tenta seletores específicos primeiro
            const specificIdEl = document.querySelector('.codigo_produto, [itemprop="identifier"], .productReference');
            if (specificIdEl) {
                const text = getSafeText(specificIdEl);
                const match = text.match(/\d+/); // Pega apenas a primeira sequência de números
                if (match) id = match[0];
            }

            // Fallback: Busca nos arredores do nome (H1)
            if (id === 'unknown' && h1) {
                let current = h1.nextElementSibling;
                for (let i = 0; i < 5 && current; i++) {
                    const text = getSafeText(current);
                    const match = text.match(/\d+/);
                    if (match && match[0].length >= 4) { // IDs costumam ter pelo menos 4 dígitos
                        id = match[0];
                        break;
                    }
                    current = current.nextElementSibling;
                }
            }

            // Fallback final: Corpo
            if (id === 'unknown') {
                const bodyText = getSafeText(document.body);
                const matchBody = bodyText.match(/Cód\.?:?\s*(\d+)/i) || bodyText.match(/Ref\.?:?\s*(\d+)/i);
                if (matchBody) id = matchBody[1];
            }

            return {
                id,
                nome,
                precoAtual: preco,
                precoOriginal: preco_original,
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href
            };
        });

        if (data) {
            console.log(`✅ KJU: ${data.nome} | R$${data.preco} (${data.categoria})`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeKJU, parseProductKJU };
