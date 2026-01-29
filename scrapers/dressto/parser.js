/**
 * Parser para produtos Dress To (VTEX IO)
 */
async function parseProductDressTo(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Espera de estabilização extra para sites VTEX pesados
        await page.waitForTimeout(6000);

        // Check for VTEX error
        const pageTitle = await page.title().catch(() => 'unknown');
        if (pageTitle.includes('Render Server - Error')) {
            console.log('      ⚠️ Detectado "Render Server - Error" no parser. Recarregando...');
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(5000);
        }

        // Garante que o H1 ou algum seletor de preço apareça
        try {
            await page.waitForSelector('h1, .vtex-product-price-1-x-sellingPriceValue, .vtex-product-identifier', { timeout: 15000 });
        } catch (e) {
            console.log(`      ⚠️ Timeout esperando elementos básicos de ${url} [Title: ${await page.title().catch(() => 'unknown')}]`);
        }


        const data = await page.evaluate(() => {
            const getSafeText = (el) => {
                if (!el) return '';
                const txt = el.innerText || el.textContent || '';
                return (typeof txt === 'string') ? txt.trim() : '';
            };

            // Nome
            const h1 = document.querySelector('h1, .vtex-store-components-3-x-productNameContainer, [class*="productName"]');
            const nome = getSafeText(h1);
            if (!nome) return null;

            // Preço Original SOMENTE (ignorar promoções)
            // Tenta pegar o preço principal exibido. Se tiver 'old', ignora e pega o 'old' como original? 
            // "Capture APENAS o preço original exibido na página" -> Geralmente o maior valor se houver riscado, ou o único valor.
            // DressTo markup: <s>Original</s> ... Current. Or just Current.

            // 1. Preços (VTEX Selectors)
            const getPriceValue = (sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                let txt = getSafeText(el).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                return parseFloat(txt);
            };

            const originalPriceVal = getPriceValue('.vtex-product-price-1-x-listPriceValue, .vtex-product-price-1-x-listPrice--product__info');
            const currentPriceVal = getPriceValue('.vtex-product-price-1-x-sellingPriceValue, .vtex-product-price-1-x-sellingPrice--product__info');

            let precoOriginal = originalPriceVal;
            let precoAtual = currentPriceVal;

            // Fallback Genérico (Caso seletores mudem)
            if (!precoAtual) {
                const allPrices = Array.from(document.querySelectorAll('.vtex-product-price-1-x-currencyContainer, [class*="product-price"]'))
                    .map(el => getSafeText(el))
                    .filter(txt => txt.includes('R$'));

                // Lógica simplificada de fallback aqui se necessário, mas os seletores acima são bem estáveis na VTEX
            }

            // Garantia de sanidade
            if (!precoOriginal) precoOriginal = precoAtual;
            if (precoOriginal < precoAtual) precoOriginal = precoAtual;

            // 2. Tamanhos
            // DressTo usa <li> elements com tooltips em <span> para baixo estoque
            // Ex: <li>M<span class="tooltip">1 disponível</span></li>
            const sizeElements = Array.from(document.querySelectorAll('li[class*="skuselector__item"]'));
            const tamanhos = [];

            sizeElements.forEach(li => {
                // Extract ONLY the text from the LI itself, ignoring any children spans/tooltips
                let sizeText = '';
                for (let node of li.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const t = node.textContent.trim();
                        if (t) {
                            sizeText = t;
                            break;
                        }
                    }
                }

                // If no direct text node, try getting innerText but stripping common tooltip patterns
                if (!sizeText) {
                    sizeText = li.innerText.split('\n')[0].trim();
                }

                const isUnavailable = li.className.includes('--unavailable') ||
                    li.className.includes('disabled') ||
                    li.getAttribute('aria-disabled') === 'true';

                // Valid size labels in Brazil are usually PP, P, M, G, GG, numbers, or unique letters
                const isValidSize = sizeText && sizeText.length <= 4 && !sizeText.includes('disponível') && !sizeText.includes('olho');

                if (isValidSize && !isUnavailable) {
                    tamanhos.push(sizeText.toUpperCase());
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
            else if (fullText.includes('blusa') || fullText.includes('top') || fullText.includes('camisa') || fullText.includes('regata')) categoria = 'blusa';
            else if (fullText.includes('brinco') || fullText.includes('bolsa') || fullText.includes('colar') || fullText.includes('cinto') || fullText.includes('acessório')) categoria = 'acessório';
            else if (fullText.includes('calça')) categoria = 'calça';

            // ID (Referência VTEX)
            let id = 'unknown';
            const refEl = document.querySelector('.vtex-product-identifier, .vtex-product-identifier--product-reference');
            if (refEl) {
                // Formato esperado: 01.33.2394_198 ou 01.33.2394|471
                let rawText = getSafeText(refEl);
                // Divide por qualquer separador comum
                const parts = rawText.split(/[|_-]/);
                id = parts[0].replace(/\D/g, '');
            }

            if (id === 'unknown' || id.length < 6) {
                // Fallback para URL se o ID extraído for inválido ou muito curto
                // Tenta achar padrão de 8 digitos na URL também
                // Ex: .../vestido-longo-01332394/p
                const urlMatch = window.location.href.match(/(\d{7,})/);
                if (urlMatch) id = urlMatch[1];
            }

            return {
                id,
                nome,
                precoAtual: precoAtual,
                precoOriginal: precoOriginal,
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href,
                imageUrl: (function () {
                    const gallerySelectors = [
                        '.vtex-store-components-3-x-productImageTag',
                        '.product-image',
                        '.image-gallery img',
                        'img[data-zoom]'
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
            console.log(`✅ Dress To: ${data.nome} | R$${data.precoAtual}`);
        }

        return data;

    } catch (error) {
        console.log(`❌ Erro ao parsear ${url}: ${error.message}`);
        return null;
    }
}

module.exports = { parseProductDressTo };
