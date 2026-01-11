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
async function scrapeLive(quota = 6, ignoreDuplicates = false, parentBrowser = null) {
    console.log('\n🔵 INICIANDO SCRAPER LIVE (Quota: ' + quota + ')');

    const products = [];

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
        await page.goto('https://www.liveoficial.com.br/outlet', {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        await page.waitForTimeout(5000);

        // 🛡️ Fecha popups/modais iniciais (Refinado)
        console.log('   🛡️ Verificando popups...');
        await page.evaluate(async () => {
            const closeSelectors = [
                'button.sc-f0c9328e-3.dnwgCm',
                'button[class*="close"]',
                '.modal-close',
                'button:has(svg)',
                '[aria-label="Close"]',
                '.sc-f0c9328e-0 i', // Ícone de fechar comum no site
                'div[active="true"] button'
            ];

            for (const sel of closeSelectors) {
                const els = document.querySelectorAll(sel);
                els.forEach(el => {
                    if (el && (el.offsetWidth > 0 || el.offsetHeight > 0)) {
                        el.click();
                    }
                });
            }

            // Tenta forçar o clique em botões de "Fechar" pelo texto
            const buttons = Array.from(document.querySelectorAll('button, span, a'));
            const closeBtn = buttons.find(b => {
                const t = (b.innerText || '').toLowerCase().trim();
                return t === 'x' || t === 'fechar' || t === 'close' || t === '×';
            });
            if (closeBtn) closeBtn.click();
        });
        await page.waitForTimeout(3000);

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

            if (!ignoreDuplicates && isDuplicate(product.id)) {
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
        if (shouldCloseBrowser) {
            await browser.close();
        } else {
            if (page) await page.close();
        }
    }

    // LÓGICA DE PAREAMENTO (CONJUNTOS & PEÇA ÚNICA)
    console.log(`\n🧩 Tentando formar conjuntos com ${products.length} produtos...`);
    const sets = [];
    const onePieces = [];
    const usedIndices = new Set();

    // 1. Identificação de Categorias
    products.forEach((p, i) => {
        const nome = p.nome.toLowerCase();
        if (nome.includes('macacão') || nome.includes('vestido') || nome.includes('macaquinho') || nome.includes('body')) {
            p.type = 'onepiece';
            onePieces.push(p);
            usedIndices.add(i);
        } else if (nome.includes('top') || nome.includes('cropped') || nome.includes('sutiã') || nome.includes('blusa') || nome.includes('t-shirt') || nome.includes('regata')) {
            p.type = 'top';
        } else if (nome.includes('legging') || nome.includes('short') || nome.includes('saia') || nome.includes('bermuda') || nome.includes('calça')) {
            p.type = 'bottom';
        } else {
            p.type = 'other';
        }
    });

    // 2. Formação de Pares (Top + Bottom) - Lógica Relaxada (Greedy)
    const tops = products.filter((p, i) => !usedIndices.has(i) && p.type === 'top');
    const bottoms = products.filter((p, i) => !usedIndices.has(i) && p.type === 'bottom');

    // Ordena por preço (maior primeiro) para formar conjuntos "premium" se possível, ou aleatório?
    // User não especificou. Vamos apenas iterar.

    for (const top of tops) {
        if (usedIndices.has(products.indexOf(top))) continue;

        // Tenta achar qualquer bottom e disponível
        const match = bottoms.find(b => !usedIndices.has(products.indexOf(b)));

        if (match) {
            sets.push(top);
            sets.push(match);
            usedIndices.add(products.indexOf(top));
            usedIndices.add(products.indexOf(match));
            console.log(`   💕 Conjunto Formado (Relaxado): ${top.nome} + ${match.nome}`);
        }
    }

    // 3. Montagem da Seleção Final
    // A ordem importa para o Orchestrator (que agrupa de 2 em 2).
    // MAS, como temos OnePieces (1 item) e Sets (2 itens), o Orchestrator precisa ser atualizado.
    // Por enquanto, vamos retornar uma lista mista, mas vamos tentar garantir integridade.

    let finalSelection = [];

    // Adiciona OnePieces
    // Se quota 2: 2 OnePieces? Ou 1 Set?
    // Vamos priorizar Sets se houver, depois OnePieces.

    // Adiciona Sets (Pares)
    finalSelection.push(...sets);

    // Adiciona OnePieces
    finalSelection.push(...onePieces);

    // Se ainda faltar, podemos passar singles? O usuário disse: "não duas partes de cima".
    // Então NÃO passamos singles soltos de Top/Bottom se não formarem par.
    // A menos que seja muito necessário. Vamos evitar.

    if (finalSelection.length > quota) {
        // Corta para caber na quota
        // Cuidado para não quebrar um Set no meio.
        // Sets estão em índices pares (0,1), (2,3)...
        if (sets.length >= quota) {
            finalSelection = sets.slice(0, quota);
            // Se quota for ímpar (ex: 3) e cortarmos um set (0,1,2), o item 2 fica órfão.
            // Se o item na borda for parte de um set, removemos ele.
            if (finalSelection.length % 2 !== 0 && finalSelection[finalSelection.length - 1].type !== 'onepiece') {
                finalSelection.pop();
            }
        } else {
            // Aceita todos os sets e preenche com OnePieces
            finalSelection = finalSelection.slice(0, quota);
        }
    }

    console.log(`   ⚖️ Seleção: ${sets.length / 2} Conjuntos + ${onePieces.length} Peças Únicas`);

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

            // Preço - Estratégia Otimizada (Meta Tags + Seletores Específicos)
            let numericPrices = [];

            // 1. Meta Tags (CUIDADO: Em LIVE, meta tag as vezes aponta para produto errado '199.90' vs '489.90')
            // Desabilitado temporariamente pois mostrou-se não confiável para este site específico no debug
            /*
            const metaPrice = document.querySelector('meta[property="product:price:amount"], meta[itemprop="price"]');
            if (metaPrice) {
                const val = parseFloat(metaPrice.content);
                if (!isNaN(val) && val > 0) numericPrices.push(val);
            }
            */

            // 2. Busca Híbrida Inteligente (Prioriza DIVs limpas)
            const allElements = Array.from(document.querySelectorAll('*'))
                .filter(el => {
                    // Pega apenas elementos folha (sem filhos diretos de texto misturado, mas aqui verificamos children.length)
                    // DIVs podem ter filhos, então cuidado. O debug mostrou DIV com texto direto?
                    // Debug: "tag": "DIV", "text": "R$ 489,90" -> significa que o innerText é esse.
                    // Se tiver filhos, innerText é a soma.
                    // Vamos pegar elementos cujo texto direto contenha R$

                    const txt = (el.innerText || '').trim();
                    return txt.includes('R$') && el.offsetWidth > 0;
                });

            // Separa em candidatos Fortes (DIV) e Fracos (STRONG, SPAN, P)
            // No caso da Live, o preço principal apareceu em DIV. Recomendações em STRONG.
            const strongCandidates = [];
            const weakCandidates = [];

            allElements.forEach(el => {
                const txt = (el.innerText || '').trim();

                // Filtros de Exclusão (Parcelamento / Juros)
                if (/\d+\s*x|x\s*de|\/|parcel|sem\s+juros|em\s+até|juros|cashback/i.test(txt)) return;
                // Exclui se o texto completo é muito longo (provavelmente um bloco de texto)
                if (txt.length > 50) return;

                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '').replace(',', '.');
                    const val = parseFloat(valStr);

                    if (!isNaN(val) && val >= 50) { // Filtro minimo R$50 to avoid installments
                        if (el.tagName === 'DIV' || el.classList.contains('skuBestPrice') || el.classList.contains('vtex-product-price-1-x-sellingPriceValue')) {
                            strongCandidates.push(val);
                        } else {
                            weakCandidates.push(val);
                        }
                    }
                }
            });

            // Se tiver candidatos fortes (DIVs), usa eles.
            if (strongCandidates.length > 0) {
                // Remove duplicatas e ordena
                const unique = [...new Set(strongCandidates)].sort((a, b) => a - b);
                // Pega o menor preço forte (geralmente preço a vista/promocional dentro do bloco principal)
                numericPrices = unique;
            } else {
                // Fallback para fracos
                const unique = [...new Set(weakCandidates)].sort((a, b) => a - b);
                numericPrices = unique;
            }

            if (numericPrices.length === 0) return null;

            // O menor preço válido
            const preco = numericPrices[0];

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

            return finalData;
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

module.exports = { scrapeLive, parseProductLive };
