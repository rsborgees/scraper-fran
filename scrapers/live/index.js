const { initBrowser } = require('../../browser_setup');
const path = require('path');
const fs = require('fs');
const { processProductUrl, processImageDirect } = require('../../imageDownloader');

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
            return [...new Set(links.map(a => a.href))]
                .filter(url => {
                    const path = new URL(url).pathname;
                    // URLs de produtos na Live geralmente terminam em /p ou /p/ e são longas
                    return (path.endsWith('/p') || path.includes('/p/')) &&
                        path.length > 15 &&
                        !path.includes('/carrinho') &&
                        !path.includes('/login') &&
                        path !== '/produtos/p'; // Exclui links genéricos se houver
                });
        });

        console.log(`   🔎 Encontrados ${productUrls.length} produtos candidatos.`);

        for (const url of productUrls) {
            if (products.length >= quota) break;

            const product = await parseProductLive(page, url);
            if (product) {
                // Image Download Integration com ID já extraído
                console.log(`🖼️  Baixando imagem com ID: ${product.id}...`);
                let imagePath = null;
                try {
                    // OTIMIZAÇÃO: Usa processImageDirect se tivermos a URL, evitando abrir novo navegador
                    let imgResult;
                    if (product.imageUrl) {
                        imgResult = await processImageDirect(product.imageUrl, 'LIVE', product.id);
                    } else {
                        // Fallback (lento)
                        console.warn('   ⚠️ URL da imagem não encontrada no parse, usando método lento...');
                        imgResult = await processProductUrl(url, product.id);
                    }

                    if (imgResult.status === 'success' && imgResult.cloudinary_urls && imgResult.cloudinary_urls.length > 0) {
                        imagePath = imgResult.cloudinary_urls[0];
                        console.log(`   ✔️  Imagem salva: ${imagePath}`);
                    } else {
                        console.log(`   ⚠️  Falha download imagem: ${imgResult.reason}`);
                    }
                } catch (err) {
                    console.log(`   ❌ Erro download imagem: ${err.message}`);
                }

                product.loja = 'live';
                product.desconto = 0; // Explicitly 0
                product.imagePath = imagePath;
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

            // Preço Original SOMENTE (ignorar promoções)
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
                    if (!isNaN(val) && val > 0) {
                        numericPrices.push(val);
                    }
                }
            });

            if (numericPrices.length === 0) return null;

            // Apenas UM preço (o máximo encontrado)
            const preco = Math.max(...numericPrices);

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
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href,
                imageUrl: (function () {
                    const gallerySelectors = [
                        '.product-image',
                        '.vtex-store-components-3-x-productImageTag',
                        '.swiper-slide-active img',
                        '.image-gallery img',
                        'img[data-zoom]',
                        'img[srcset]' // Fallback comum
                    ];

                    let candidates = [];
                    for (const sel of gallerySelectors) {
                        const els = document.querySelectorAll(sel);
                        if (els.length > 0) candidates.push(...Array.from(els));
                    }
                    if (candidates.length === 0) {
                        candidates = Array.from(document.querySelectorAll('img'))
                            .filter(img => img.width > 250 && img.height > 250);
                    }
                    if (candidates.length === 0) {
                        const ogImg = document.querySelector('meta[property="og:image"]');
                        if (ogImg && ogImg.content) return ogImg.content;
                    }

                    const bestImg = candidates.find(img => (img.currentSrc || img.src) && !(img.src || '').includes('svg'));
                    return bestImg ? (bestImg.currentSrc || bestImg.src) : null;
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
