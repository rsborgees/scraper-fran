const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');
const { processProductUrl, processImageDirect } = require('../../imageDownloader');
const { isDuplicate, markAsSent } = require('../../historyManager');

const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Scraper LIVE
 * URL: https://www.liveoficial.com.br/outlet
 * Quota: 6 produtos
 * Usar SOMENTE preço à vista (ignorar parcelamento)
 */
async function scrapeLive(quota = 6) {
    console.log('\n🔵 INICIANDO SCRAPER LIVE (Quota: ' + quota + ')');

    const products = [];
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.liveoficial.com.br/outlet', {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        await page.waitForTimeout(5000);

        // 🛡️ Fecha popups/modais iniciais
        console.log('   🛡️ Verificando popups...');
        await page.evaluate(() => {
            // Seletores identificados via inspeção
            const closeSelectors = [
                'button.sc-f0c9328e-3.dnwgCm', // Popup Perfis Falsos
                'button[class*="close"]',
                '.modal-close',
                'button:has(svg)',
                '[aria-label="Close"]'
            ];

            closeSelectors.forEach(sel => {
                const btn = document.querySelector(sel);
                if (btn && btn.offsetWidth > 0) {
                    console.log(`      ✔️ Fechando popup: ${sel}`);
                    btn.click();
                }
            });

            // Tenta fechar por texto "×" se nada acima funcionar
            const allButtons = Array.from(document.querySelectorAll('button'));
            const xButton = allButtons.find(b => b.innerText.trim() === '×' || b.innerText.trim().toLowerCase() === 'fechar');
            if (xButton) xButton.click();
        });
        await page.waitForTimeout(2000);

        // Screenshot
        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: path.join(DEBUG_DIR, 'live_list.png') });

        // 📜 Rolagem mais profunda para carregar produtos
        console.log('   📜 Rolando página para carregar produtos...');
        await page.evaluate(async () => {
            for (let i = 0; i < 5; i++) {
                window.scrollBy(0, 800);
                await new Promise(r => setTimeout(r, 1000));
            }
        });

        // Coleta URLs de produtos (Links terminando em /p ou contendo /p/)
        const productUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            console.log(`Total links found on page: ${links.length}`);

            // Log a few links to see what they look like
            const sampleLinks = links.slice(0, 10).map(a => a.href);
            console.log(`Sample links: ${JSON.stringify(sampleLinks)}`);

            return [...new Set(links.map(a => a.href))]
                .filter(url => {
                    try {
                        const parsed = new URL(url);
                        if (parsed.hostname !== window.location.hostname && !url.startsWith('/')) return false;

                        const path = parsed.pathname;

                        // URLs de produtos na Live geralmente terminam em /p ou /p/ e são longas
                        // Mas vamos ser mais flexíveis se não acharmos nada
                        const isProductPattern = (path.endsWith('/p') || path.includes('/p/')) && path.length > 10;
                        const isExcluded = path.includes('/carrinho') || path.includes('/login') || path === '/produtos/p';

                        return isProductPattern && !isExcluded;
                    } catch (e) {
                        return false;
                    }
                });
        });

        console.log(`   🔎 Encontrados ${productUrls.length} produtos candidatos.`);
        if (productUrls.length === 0) {
            const totalA = await page.evaluate(() => document.querySelectorAll('a').length);
            console.log(`   ⚠️ Nenhum produto encontrado com padrão /p. Total de links na página: ${totalA}`);
            // Fallback: Pega todos os links longos que não são categorias conhecidas
            const fallbackUrls = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                return [...new Set(links.map(a => a.href))].filter(url => {
                    try {
                        const path = new URL(url).pathname;
                        return path.split('/').length >= 2 && path.length > 25 &&
                            !['/carrinho', '/login', '/checkout', '/account'].some(s => path.includes(s));
                    } catch (e) { return false; }
                });
            });
            console.log(`   💡 Fallback encontrou ${fallbackUrls.length} links longos.`);
            productUrls.push(...fallbackUrls.slice(0, 20)); // Limita fallback
        }

        for (const url of productUrls) {
            if (products.length >= quota * 3) break;

            console.log(`\n   🔎 Processando: ${url}`);
            const product = await parseProductLive(page, url);

            if (!product) continue;

            if (isDuplicate(product.id)) {
                console.log(`   ⏭️  Duplicado (Histórico): ${product.id}`);
                continue;
            }

            product.loja = 'live';
            product.precoAtual = product.preco;
            product.precoOriginal = product.preco_original || product.preco;
            product.desconto = product.precoOriginal - product.precoAtual;
            if (product.desconto < 0) product.desconto = 0;

            products.push(product);
        }


    } catch (error) {
        console.error(`Erro no scraper Live: ${error.message}`);
    } finally {
        await browser.close();
    }

    // LÓGICA DE PAREAMENTO (CONJUNTOS)
    console.log(`\n🧩 Tentando formar conjuntos com ${products.length} produtos...`);
    const sets = [];
    const singles = [];
    const usedIndices = new Set();

    // Separa Tops e Bottoms
    const tops = products.filter((p, i) => !usedIndices.has(i) && (p.nome.includes('Top') || p.nome.includes('Cropped') || p.nome.includes('Sutiã')));
    const bottoms = products.filter((p, i) => !usedIndices.has(i) && (p.nome.includes('Legging') || p.nome.includes('Short') || p.nome.includes('Saia')));

    // Tenta pares por nome similar
    for (const top of tops) {
        // Encontra bottom com maior similaridade de nome (ex: "Legging Fit" e "Top Fit")
        // Simplificado: 2 palavras em comum (ignora 'Top', 'Legging', 'de', 'para')
        const topWords = top.nome.toLowerCase().split(' ').filter(w => w.length > 3 && !['top', 'cropped'].includes(w));

        const match = bottoms.find(b => {
            const bWords = b.nome.toLowerCase().split(' ');
            const intersections = topWords.filter(w => bWords.includes(w));
            return intersections.length >= 1; // Pelo menos 1 palavra chave igual (ex: "Nebulosa", "Velvet")
        });

        if (match) {
            sets.push(top);
            sets.push(match);
            usedIndices.add(products.indexOf(top));
            usedIndices.add(products.indexOf(match));
        }
    }

    // Preenche o resto
    products.forEach((p, i) => {
        if (!usedIndices.has(i)) singles.push(p);
    });

    // Prioriza Conjuntos
    const finalSelection = [...sets];

    // Completa com singles se precisar
    if (finalSelection.length < quota) {
        const remaining = quota - finalSelection.length;
        finalSelection.push(...singles.slice(0, remaining));
    }

    // Processa imagens (apenas dos selecionados) e marca como enviado
    const output = [];
    for (const p of finalSelection.slice(0, quota)) {
        // Image logic moved here to save resources on unused items? 
        // Actually we already checked imageUrl in the parser, but download happens here?
        // No, the original code downloaded inside the loop. 
        // To optimize, we should have pushed `product` to `products` WITHOUT downloading, and download only `finalSelection`.
        // BUT, the parser extracts the ID.
        // Let's keep the download logic in the loop for now to be safe with the "optimizations" previously made, 
        // OR better: Move download to here.

        // Since I removed the inner loop download block in this replacement (it was replaced by 'products.push'), 
        // I need to add the download logic back here.

        console.log(`🖼️  [Final] Baixando imagem: ${p.nome}...`);
        try {
            let imgResult;
            if (p.imageUrl) {
                imgResult = await processImageDirect(p.imageUrl, 'LIVE', p.id);
            } else {
                imgResult = await processProductUrl(p.url, p.id);
            }
            if (imgResult.status === 'success' && imgResult.cloudinary_urls?.length) {
                p.imagePath = imgResult.cloudinary_urls[0];
            }
        } catch (e) { console.error(e.message); }

        markAsSent([p.id]);
        output.push(p);
    }

    console.log(`\n✅ LIVE: ${output.length}/${quota} produtos selecionados (Conjuntos priorizados)`);
    return output;
}

async function parseProductLive(page, url) {
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

            // Preço - Estratégia Robusta
            // 1. Busca por "Por R$" (preço de venda)
            // 2. Filtra parcelas (valores pequenos ou com "x")
            // 3. Usa menor preço válido (>= R$ 50)

            const allPrices = Array.from(document.querySelectorAll('*'))
                .filter(el => el.children.length === 0 && getSafeText(el).includes('R$'))
                .map(el => getSafeText(el));

            // Prioridade 1: Buscar "Por R$" explicitamente
            const porPriceText = allPrices.find(txt => /por\s+R\$/i.test(txt));
            if (porPriceText) {
                const match = porPriceText.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '');
                    if (valStr.includes(',')) {
                        valStr = valStr.replace(',', '.');
                    } else {
                        valStr = valStr + '.00';
                    }
                    const preco = parseFloat(valStr);
                    if (!isNaN(preco) && preco >= 50) {
                        // Encontrou preço "Por" válido - continua para extrair outros dados
                        const tamanhos = [];
                        const sizeEls = Array.from(document.querySelectorAll('[class*="size"], [class*="tamanho"], button, li, label'));

                        sizeEls.forEach(el => {
                            let txt = getSafeText(el).toUpperCase();
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

                        let categoria = 'outros';
                        const breadcrumb = getSafeText(document.querySelector('.breadcrumb, .vtex-breadcrumb-1-x-container')).toLowerCase();
                        const lowerNome = nome.toLowerCase();
                        const combinedText = (lowerNome + ' ' + breadcrumb).toLowerCase();

                        if (combinedText.includes('vestido')) categoria = 'vestido';
                        else if (combinedText.includes('macacão')) categoria = 'macacão';
                        else if (combinedText.includes('blusa') || combinedText.includes('camiseta') || combinedText.includes('regata') || combinedText.includes('top')) categoria = 'blusa';
                        else if (combinedText.includes('legging') || combinedText.includes('calça') || combinedText.includes('short') || combinedText.includes('saia')) categoria = 'roupa';
                        else if (combinedText.includes('jaqueta') || combinedText.includes('casaco')) categoria = 'roupa';
                        else categoria = 'roupa';

                        let id = 'unknown';
                        const refEl = document.querySelector('.vtex-product-identifier, .productReference, .sku');
                        if (refEl) {
                            id = getSafeText(refEl).replace(/\D/g, '');
                        }

                        if (id === 'unknown' || id === '') {
                            const urlMatch = window.location.href.match(/(\d+)(AZ|00|BC|[\-\/])/);
                            if (urlMatch) {
                                id = urlMatch[1];
                            } else {
                                const longNumMatch = window.location.href.match(/(\d{5,})/);
                                if (longNumMatch) id = longNumMatch[1];
                            }
                        }

                        return {
                            id,
                            nome,
                            preco,
                            preco_original: Math.max(...numericPrices, preco),
                            tamanhos: [...new Set(tamanhos)],
                            categoria,
                            url: window.location.href,
                            imageUrl: (function () {
                                const ogImg = document.querySelector('meta[property="og:image"]');
                                if (ogImg && ogImg.content) return ogImg.content;

                                const imgs = Array.from(document.querySelectorAll('img'));
                                const productImg = imgs.find(img =>
                                    img.src &&
                                    img.src.includes('/product/') &&
                                    img.width > 200
                                );
                                if (productImg) return productImg.src;

                                const fallback = imgs.find(img => img.width > 300 && img.height > 300);
                                return fallback ? fallback.src : null;
                            })()
                        };
                    }
                }
            }

            // Prioridade 2: Filtro robusto de parcelas
            const realPrices = allPrices.filter(txt => {
                // Exclui textos com indicadores de parcelamento
                if (/\d+\s*x|x\s*de|\/|parcel|sem\s+juros|em\s+até/i.test(txt)) return false;

                // Exclui se o texto completo contém "x" seguido de "R$"
                if (/\d+\s*x\s*R\$/i.test(txt)) return false;

                return true;
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
                    // Filtra valores muito baixos (provavelmente parcelas)
                    if (!isNaN(val) && val >= 50) {
                        numericPrices.push(val);
                    }
                }
            });

            if (numericPrices.length === 0) return null;

            // Se houver múltiplos preços, pega o menor (preço de venda após desconto)
            const preco = Math.min(...numericPrices);

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

            // Categoria (Mapeamento mais preciso)
            let categoria = 'outros';
            const breadcrumb = getSafeText(document.querySelector('.breadcrumb, .vtex-breadcrumb-1-x-container')).toLowerCase();
            const lowerNome = nome.toLowerCase();
            const combinedText = (lowerNome + ' ' + breadcrumb).toLowerCase();

            if (combinedText.includes('vestido')) categoria = 'vestido';
            else if (combinedText.includes('macacão')) categoria = 'macacão';
            else if (combinedText.includes('blusa') || combinedText.includes('camiseta') || combinedText.includes('regata') || combinedText.includes('top')) categoria = 'blusa';
            else if (combinedText.includes('legging') || combinedText.includes('calça') || combinedText.includes('short') || combinedText.includes('saia')) categoria = 'roupa';
            else if (combinedText.includes('jaqueta') || combinedText.includes('casaco')) categoria = 'roupa';
            else categoria = 'roupa'; // Default para Live que vende majoritariamente vestuário

            // ID (Tenta buscar no seletor da VTEX específico ou na URL)
            let id = 'unknown';
            const refEl = document.querySelector('.vtex-product-identifier, .productReference, .sku');
            if (refEl) {
                id = getSafeText(refEl).replace(/\D/g, '');
            }

            if (id === 'unknown' || id === '') {
                // Tenta pegar o código numérico da URL (geralmente antes do /p)
                const urlMatch = window.location.href.match(/(\d+)(AZ|00|BC|[\-\/])/);
                if (urlMatch) {
                    id = urlMatch[1];
                } else {
                    // Fallback para qualquer sequência numérica longa
                    const longNumMatch = window.location.href.match(/(\d{5,})/);
                    if (longNumMatch) id = longNumMatch[1];
                }
            }

            return {
                id,
                nome,
                preco,
                preco_original: Math.max(...numericPrices, preco),
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href,
                imageUrl: (function () {
                    // Estratégia Híbrida Robustez + Velocidade

                    // 1. Meta Tag (Geralmente a mais rápida e confiável)
                    const ogImg = document.querySelector('meta[property="og:image"]');
                    if (ogImg && ogImg.content) return ogImg.content;

                    // 2. Busca por padrão de URL (/product/)
                    const imgs = Array.from(document.querySelectorAll('img'));
                    const productImg = imgs.find(img =>
                        img.src &&
                        img.src.includes('/product/') &&
                        img.width > 200
                    );
                    if (productImg) return productImg.src;

                    // 3. Fallback: Qualquer imagem grande
                    const fallback = imgs.find(img => img.width > 300 && img.height > 300);
                    return fallback ? fallback.src : null;
                })()
            };
        });

        if (data) {
            console.log(`✅ Live: ${data.nome} | R$${data.preco}`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { scrapeLive };
