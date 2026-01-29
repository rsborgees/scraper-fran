/**
 * Parser para produtos Dress To (VTEX IO)
 */

// 🆘 PLANO D: Server-Side API Fallback (quando o browser falha completamente)
async function fetchViaVtexAPI(productSlug) {
    try {
        // VTEX API funciona melhor com o slug completo do produto
        const apiUrl = `https://www.dressto.com.br/api/catalog_system/pub/products/search/${productSlug}?sc=1`;
        console.log(`      🔄 [SERVER-SIDE] Tentando API VTEX: ${apiUrl}`);

        const response = await fetch(apiUrl);
        if (!response.ok) {
            console.log(`      ❌ API retornou status ${response.status}`);
            return null;
        }

        const json = await response.json();
        if (!json || json.length === 0) {
            console.log(`      ❌ API não retornou produtos para ID ${productId}`);
            return null;
        }

        const pApi = json[0];

        // Categoria
        let categoria = 'outros';
        const catRaw = (pApi.categories && pApi.categories.length) ? pApi.categories[0].toLowerCase() : '';
        if (catRaw.includes('vestido')) categoria = 'vestido';
        else if (catRaw.includes('macac')) categoria = 'macacão';
        else if (catRaw.includes('saia')) categoria = 'saia';
        else if (catRaw.includes('short')) categoria = 'short';
        else if (catRaw.includes('blus') || catRaw.includes('top')) categoria = 'blusa';
        else if (catRaw.includes('brinc') || catRaw.includes('colar') || catRaw.includes('bolsa')) categoria = 'acessório';
        else if (catRaw.includes('calc')) categoria = 'calça';

        // Primeiro item disponível
        const item = pApi.items.find(i => i.sellers && i.sellers[0].commertialOffer.AvailableQuantity > 0) || pApi.items[0];
        if (!item) return null;

        const comm = item.sellers[0].commertialOffer;

        // Tamanhos disponíveis
        const tamanhos = [];
        pApi.items.forEach(itm => {
            if (itm.sellers[0].commertialOffer.AvailableQuantity > 0) {
                tamanhos.push(itm.name.toUpperCase());
            }
        });

        if (tamanhos.length === 0) return null;

        const result = {
            id: pApi.productReference || productId,
            nome: pApi.productName,
            precoAtual: comm.Price,
            precoOriginal: comm.ListPrice || comm.Price,
            tamanhos: [...new Set(tamanhos)],
            categoria,
            url: `https://www.dressto.com.br${pApi.link}`,
            imageUrl: (item.images && item.images.length) ? item.images[0].imageUrl : null
        };

        console.log(`      ✅ [SERVER-SIDE] Produto extraído via API: ${result.nome}`);
        return result;

    } catch (err) {
        console.error(`      ❌ [SERVER-SIDE] Erro na API: ${err.message}`);
        return null;
    }
}

async function parseProductDressTo(page, url) {
    try {
        // 🛡️ ANTI-REDIRECT: Garantir sc=1 em DressTo para evitar Shopify Redirect
        const targetUrl = url.includes('sc=1') ? url : (url.includes('?') ? `${url}&sc=1` : `${url}?sc=1`);

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Espera de estabilização extra para sites VTEX pesados
        await page.waitForTimeout(6000);

        // Check for VTEX error
        const pageTitle = await page.title().catch(() => 'unknown');
        if (pageTitle.includes('Render Server - Error')) {
            console.log('      ⚠️ Detectado "Render Server - Error" no parser. Recarregando...');
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(5000);

            // Verifica novamente após reload
            const titleAfterReload = await page.title().catch(() => 'unknown');
            if (titleAfterReload.includes('Render Server - Error')) {
                console.log('      🆘 Erro 500 persistiu após reload. Ativando fallback SERVER-SIDE...');

                // Extrai SLUG completo da URL (ex: vestido-cropped-estampa-mares-01342814-2384)
                const urlPath = new URL(targetUrl).pathname;
                const slugMatch = urlPath.match(/\/([^\/]+)\/p$/);
                if (slugMatch) {
                    const productSlug = slugMatch[1];
                    console.log(`      🔍 Slug extraído da URL: ${productSlug}`);
                    const apiResult = await fetchViaVtexAPI(productSlug);
                    if (apiResult) {
                        return apiResult;
                    }
                } else {
                    // Tenta extrair ID da URL (ex: ?_q=02083385 ou /02083385)
                    const idFromUrl = targetUrl.match(/[?&_q=\/](\d{8})/);
                    if (idFromUrl) {
                        const productId = idFromUrl[1];
                        console.log(`      🔍 ID extraído da URL (sem slug): ${productId}`);
                        const apiResult = await fetchViaVtexAPI(productId);
                        if (apiResult) {
                            return apiResult;
                        }
                    }
                }

                console.log('      ❌ Fallback SERVER-SIDE também falhou.');
                return null;
            }
        }

        // Garante que o H1 ou algum seletor de preço apareça
        try {
            await page.waitForSelector('h1, .vtex-product-price-1-x-sellingPriceValue, .vtex-product-identifier', { timeout: 15000 });
        } catch (e) {
            console.log(`      ⚠️ Timeout esperando elementos básicos de ${targetUrl} [Title: ${await page.title().catch(() => 'unknown')}]`);
        }


        const data = await page.evaluate(async () => {
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

            // Tenta extrair ID da URL se ainda não tiver
            if (id === 'unknown' || id.length < 5) {
                const urlMatch = window.location.href.match(/(\d{7,})/);
                if (urlMatch) id = urlMatch[1];
            }

            console.log(`[DEBUG_PARSER] ID: ${id}, Nome: ${nome}, Preco: ${precoAtual}`);

            // 🕵️ PLANO C: VTEX API FETCH
            // Se tudo falhou (DOM vazio, State vazio), tentamos a API pública de catálogo
            if ((!nome || !precoAtual) && id && id !== 'unknown') {
                // Sincrono: não podemos usar await dentro desse bloco síncrono da evaluate facilmente sem mudar a estrutura
                // Mas evaluate suporta async se a função inteira for async. E ela é.
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

            // 🕵️ PLANO C: VTEX API FETCH (Executado se falha anterior)
            if ((!nome || !precoAtual) && id && id.length > 4) {
                try {
                    const apiUrl = `/api/catalog_system/pub/products/search?ft=${id}&sc=1`;
                    console.log('      🔄 Tentando fallback via API Fetch: ' + apiUrl);
                    const resp = await fetch(apiUrl);
                    if (resp.ok) {
                        const json = await resp.json();
                        if (json && json.length > 0) {
                            const pApi = json[0];
                            // Preenche dados faltantes
                            if (!nome) nome = pApi.productName;
                            if (!categoria || categoria === 'outros') {
                                const catRaw = (pApi.categories && pApi.categories.length) ? pApi.categories[0].toLowerCase() : '';
                                if (catRaw.includes('vestido')) categoria = 'vestido';
                                else if (catRaw.includes('macac')) categoria = 'macacão';
                                else if (catRaw.includes('saia')) categoria = 'saia';
                                else if (catRaw.includes('short')) categoria = 'short';
                                else if (catRaw.includes('blus') || catRaw.includes('top')) categoria = 'blusa';
                                else if (catRaw.includes('brinc') || catRaw.includes('colar') || catRaw.includes('bolsa')) categoria = 'acessório';
                                else if (catRaw.includes('calc')) categoria = 'calça';
                            }

                            // Preços e Tamanhos do primeiro item disponível
                            const item = pApi.items.find(i => i.sellers && i.sellers[0].commertialOffer.AvailableQuantity > 0) || pApi.items[0];
                            if (item) {
                                const comm = item.sellers[0].commertialOffer;
                                precoAtual = comm.Price;
                                precoOriginal = comm.ListPrice;

                                // Tamanhos disponíveis
                                pApi.items.forEach(itm => {
                                    if (itm.sellers[0].commertialOffer.AvailableQuantity > 0) {
                                        tamanhos.push(itm.name.toUpperCase());
                                    }
                                });

                                // Image
                                if (!imageUrl && item.images && item.images.length) imageUrl = item.images[0].imageUrl;
                            }
                        }
                    }
                } catch (errApi) {
                    console.error('      ❌ Erro no Fallback API: ' + errApi.message);
                }
            }

            // Garante precoOriginal >= precoAtual
            if (!precoOriginal) precoOriginal = precoAtual;
            if (precoOriginal < precoAtual) precoOriginal = precoAtual;

            if (tamanhos.length === 0) return null;

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
