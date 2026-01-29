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

            // 🕵️ FALLBACK ESTRATÉGIA: VTEX __STATE__
            // Se a página visual falhou (Erro 500), tentamos extrair do objeto de estado global
            const state = window.__STATE__;
            let stateProduct = null;
            if (state) {
                const productKey = Object.keys(state).find(k => k.startsWith('Product:'));
                if (productKey) stateProduct = state[productKey];
            }

            // Nome
            const h1 = document.querySelector('h1, .vtex-store-components-3-x-productNameContainer, [class*="productName"]');
            let nome = getSafeText(h1);
            if (!nome && stateProduct) nome = stateProduct.productName;
            if (!nome) return null;

            // Preço (VTEX Selectors)
            const getPriceValue = (sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                let txt = getSafeText(el).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                return parseFloat(txt);
            };

            let precoOriginal = getPriceValue('.vtex-product-price-1-x-listPriceValue, .vtex-product-price-1-x-listPrice--product__info');
            let precoAtual = getPriceValue('.vtex-product-price-1-x-sellingPriceValue, .vtex-product-price-1-x-sellingPrice--product__info');

            // Fallback Preço via __STATE__
            if (!precoAtual && stateProduct) {
                // Procura a oferta no state
                const skuKey = (stateProduct.items && stateProduct.items.length > 0) ? stateProduct.items[0].id : null;
                if (skuKey) {
                    const priceKey = Object.keys(state).find(k => k.includes(`Price({"item":${JSON.stringify(skuKey)}`) || k.includes(`{"item":${JSON.stringify(skuKey)}`));
                    if (priceKey && state[priceKey]) {
                        precoAtual = state[priceKey].sellingPrice;
                        precoOriginal = state[priceKey].listPrice || precoAtual;
                    }
                }
            }

            // Garante precoOriginal >= precoAtual
            if (!precoOriginal) precoOriginal = precoAtual;
            if (precoOriginal < precoAtual) precoOriginal = precoAtual;

            // 2. Tamanhos
            const sizeElements = Array.from(document.querySelectorAll('li[class*="skuselector__item"]'));
            const tamanhos = [];

            sizeElements.forEach(li => {
                let sizeText = '';
                for (let node of li.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const t = node.textContent.trim();
                        if (t) { sizeText = t; break; }
                    }
                }
                if (!sizeText) sizeText = li.innerText.split('\n')[0].trim();

                const isUnavailable = li.className.includes('--unavailable') ||
                    li.className.includes('disabled') ||
                    li.getAttribute('aria-disabled') === 'true';

                const isValidSize = sizeText && sizeText.length <= 4 && !sizeText.includes('disponível');
                if (isValidSize && !isUnavailable) {
                    tamanhos.push(sizeText.toUpperCase());
                }
            });

            // Fallback Tamanhos via __STATE__
            if (tamanhos.length === 0 && stateProduct && stateProduct.items) {
                stateProduct.items.forEach(item => {
                    const sku = state[`Item:${item.id}`];
                    // Verifica se tem estoque no SKU ou via Seller
                    const isAvailable = item.sellers && item.sellers.some(s => {
                        const comm = state[s.id];
                        return comm && comm.commertialOffer && comm.commertialOffer.AvailableQuantity > 0;
                    });

                    if (isAvailable && item.name) {
                        tamanhos.push(item.name.toUpperCase());
                    }
                });
            }

            if (tamanhos.length === 0) return null;

            // Categoria
            let categoria = 'outros';
            const pageTitle = (document.title || '').toLowerCase();
            const breadcrumbEl = document.querySelector('.vtex-breadcrumb-1-x-container');
            const breadcrumb = (breadcrumbEl ? getSafeText(breadcrumbEl) : '').toLowerCase();
            const fullText = (pageTitle + ' ' + breadcrumb + ' ' + nome.toLowerCase());

            if (fullText.includes('vestido')) categoria = 'vestido';
            else if (fullText.includes('macacão') || fullText.includes('macaquinho')) categoria = 'macacão';
            else if (fullText.includes('saia')) categoria = 'saia';
            else if (fullText.includes('short')) categoria = 'short';
            else if (fullText.includes('blusa') || fullText.includes('top') || fullText.includes('camisa') || fullText.includes('regata')) categoria = 'blusa';
            else if (fullText.includes('brinco') || fullText.includes('bolsa') || fullText.includes('colar') || fullText.includes('cinto') || fullText.includes('acessório')) categoria = 'acessório';
            else if (fullText.includes('calça')) categoria = 'calça';

            // ID
            let id = 'unknown';
            const refEl = document.querySelector('.vtex-product-identifier, .vtex-product-identifier--product-reference');
            if (refEl) {
                id = getSafeText(refEl).split(/[|_-]/)[0].replace(/\D/g, '');
            }
            if ((id === 'unknown' || id.length < 5) && stateProduct) {
                id = stateProduct.productReference || stateProduct.productId;
            }

            // Image
            let imageUrl = (function () {
                const bestImgEl = document.querySelector('.vtex-store-components-3-x-productImageTag, img[data-zoom]');
                if (bestImgEl) return bestImgEl.currentSrc || bestImgEl.src;

                if (stateProduct && stateProduct.items && stateProduct.items.length > 0) {
                    const firstItem = stateProduct.items[0];
                    if (firstItem.images && firstItem.images.length > 0) {
                        return firstItem.images[0].imageUrl;
                    }
                }
                return null;
            })();

            return {
                id,
                nome,
                precoAtual,
                precoOriginal,
                tamanhos: [...new Set(tamanhos)],
                categoria,
                url: window.location.href,
                imageUrl
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
