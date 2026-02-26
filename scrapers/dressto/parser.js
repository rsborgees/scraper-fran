/**
 * Parser para produtos Dress To (VTEX IO)
 */

// 🆘 PLANO D: Server-Side API Fallback (quando o browser falha completamente)
async function fetchViaVtexAPI(searchKey) {
    try {
        // VTEX API: Try slug first, then ft (text search) fallback
        let apiUrl = `https://www.dressto.com.br/api/catalog_system/pub/products/search/${searchKey}?sc=1`;
        console.log(`      🔄 [SERVER-SIDE] Tentando API VTEX (Slug): ${apiUrl}`);

        // Common headers for VTEX APIs on international IPs
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Cookie': 'vtex_segment=eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9'
        };

        let response = await fetch(apiUrl, { headers });
        console.log(`      🔄 [SERVER-SIDE] Status API VTEX: ${response.status} ${response.statusText}`);

        let json = [];

        if (response.ok) {
            json = await response.json();
            console.log(`      ✅ [SERVER-SIDE] API retornou ${json.length} itens (Slug).`);
        }

        // Fallback: Text search (ft) if slug failed or returned nothing
        if (!json || json.length === 0) {
            // Tenta extrair o ID de 8 dígitos do searchKey (slug)
            // Ex: vestido-01342814-2384 -> 01342814
            const idMatch = searchKey.match(/(\d{2})[.-]?(\d{2})[.-]?(\d{4})/);
            const cleanId = idMatch ? `${idMatch[1]}${idMatch[2]}${idMatch[3]}` : searchKey.replace(/\D/g, '');

            // Try clean ID first
            apiUrl = `https://www.dressto.com.br/api/catalog_system/pub/products/search?ft=${cleanId || searchKey}&sc=1`;
            console.log(`      🔄 [SERVER-SIDE] Fallback API VTEX (ft): ${apiUrl}`);
            response = await fetch(apiUrl, { headers });
            console.log(`      🔄 [SERVER-SIDE] Status Fallback (ft): ${response.status}`);
            if (response.ok) {
                json = await response.json();
                console.log(`      ✅ [SERVER-SIDE] API retornou ${json.length} itens (ft).`);
            }

            // Try with dots if it's an 8-digit ID (DressTo standard: XX.XX.XXXX)
            if ((!json || json.length === 0) && cleanId.length === 8) {
                const dottedId = `${cleanId.substring(0, 2)}.${cleanId.substring(2, 4)}.${cleanId.substring(4, 8)}`;
                apiUrl = `https://www.dressto.com.br/api/catalog_system/pub/products/search?ft=${dottedId}&sc=1`;
                console.log(`      🔄 [SERVER-SIDE] Fallback API VTEX (dots): ${apiUrl}`);
                response = await fetch(apiUrl, { headers });
                console.log(`      🔄 [SERVER-SIDE] Status Fallback (dots): ${response.status}`);
                if (response.ok) {
                    json = await response.json();
                    console.log(`      ✅ [SERVER-SIDE] API retornou ${json.length} itens (dots).`);
                }
            }
        }

        if (!json || json.length === 0) {
            console.log(`      ❌ [SERVER-SIDE] API realmente não retornou nada.`);
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
        else if (catRaw.includes('casaco') || catRaw.includes('jaqueta') || catRaw.includes('blazer')) categoria = 'casaco';

        // Primeiro item disponível
        const item = pApi.items.find(i => i.sellers && i.sellers[0].commertialOffer.AvailableQuantity > 0) || pApi.items[0];
        if (!item) {
            console.log(`      ❌ [SERVER-SIDE] Nenhum item (SKU) encontrado.`);
            return null;
        }

        const comm = item.sellers[0].commertialOffer;

        // Tamanhos disponíveis
        const tamanhos = [];
        pApi.items.forEach(itm => {
            const hasStock = itm.sellers && itm.sellers[0] && itm.sellers[0].commertialOffer.AvailableQuantity > 0;
            if (hasStock) {
                // Tenta extrair apenas o tamanho do nome (ex: "AZUL / P" -> "P" ou "COR - P" -> "P")
                let size = itm.name;

                // Prioridade 1: Campo tamanho explícito se existir
                if (itm.tamanho && itm.tamanho.length > 0) {
                    size = itm.tamanho[0];
                }
                // Prioridade 2: Parsing de nome com múltiplos separadores
                else {
                    if (size.includes('/')) {
                        size = size.split('/').pop().trim();
                    } else if (size.includes(' - ')) {
                        size = size.split(' - ').pop().trim();
                    } else if (size.includes('-')) {
                        // Cuidado com hífen sem espaços (ex: PP-AZUL), geralmente o último é o tamanho
                        const parts = size.split('-');
                        size = parts[parts.length - 1].trim();
                    }
                }

                if (size && size.length <= 4) {
                    tamanhos.push(size.toUpperCase());
                }
            }
        });

        if (tamanhos.length === 0) {
            console.log(`      ❌ [SERVER-SIDE] Nenhum tamanho disponível encontrado.`);
            return null;
        }

        // 🚫 VALIDAÇÃO: Rejeitar roupas que só têm PP ou GG (sem P, M, G)
        const clothingCategories = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'calça', 'casaco'];
        if (clothingCategories.includes(categoria)) {
            const normalizedSizes = tamanhos.map(s => s.toUpperCase().trim());
            const isOnlyPP = normalizedSizes.length === 1 && normalizedSizes[0] === 'PP';
            const isOnlyGG = normalizedSizes.length === 1 && normalizedSizes[0] === 'GG';

            if (isOnlyPP || isOnlyGG) {
                console.log(`      ❌ [SERVER-SIDE] Apenas um tamanho extremo disponível (${tamanhos.join(', ')}) - necessário mais opções`);
                return null;
            }
        }

        const result = {
            id: pApi.productReference || searchKey,
            nome: pApi.productName,
            precoAtual: comm.Price,
            precoOriginal: comm.ListPrice || comm.Price,
            tamanhos: [...new Set(tamanhos)],
            categoria,
            url: pApi.link.startsWith('http') ? pApi.link : `https://www.dressto.com.br${pApi.link.startsWith('/') ? '' : '/'}${pApi.link}`,
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

        await page.goto(targetUrl, { waitUntil: 'load', timeout: 60000 });
        // Espera de estabilização extra para sites VTEX pesados
        await page.waitForTimeout(10000);

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

            // 2. Tamanhos (DOM)
            const sizeElements = Array.from(document.querySelectorAll('.vtex-sku-selector-2-x-skuselector__item--tamanho, li[class*="skuselector__item"]'));
            const tamanhos = [];

            sizeElements.forEach(li => {
                // Pular se for seletor de cor (muitas vezes compartilham a mesma classe base)
                if (li.innerText.length > 5 && !li.innerText.includes('\n')) return;

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

                // Validação rigorosa: Tamanhos costumam ser P, M, G, GG, 36, 38 etc.
                const isValidSize = sizeText && sizeText.length <= 4 && !sizeText.includes('disponível') && !/^[A-Z]{5,}$/.test(sizeText);

                if (isValidSize && !isUnavailable) {
                    tamanhos.push(sizeText.toUpperCase());
                }
            });

            // Fallback Tamanhos via __STATE__ (Mais confiável para evitar cores)
            if (tamanhos.length === 0 && stateProduct && stateProduct.items) {
                stateProduct.items.forEach(item => {
                    // Verifica disponibilidade
                    const isAvailable = item.sellers && item.sellers.some(s => {
                        const comm = state[s.id];
                        return comm && comm.commertialOffer && comm.commertialOffer.AvailableQuantity > 0;
                    });

                    if (isAvailable && item.name) {
                        // Limpa nome: "COR / TAMANHO" -> "TAMANHO" ou "COR - TAMANHO" -> "TAMANHO"
                        let sName = item.name;
                        if (sName.includes('/')) {
                            sName = sName.split('/').pop().trim();
                        } else if (sName.includes(' - ')) {
                            sName = sName.split(' - ').pop().trim();
                        }

                        if (sName.length <= 4) {
                            tamanhos.push(sName.toUpperCase());
                        }
                    }
                });
            }

            if (tamanhos.length === 0) return null;

            // 🚫 VALIDAÇÃO: Rejeitar roupas que só têm PP ou GG (sem P, M, G)
            const hasClothingSizes = tamanhos.some(s => ['PP', 'P', 'M', 'G', 'GG'].includes(s.toUpperCase()));
            if (hasClothingSizes) {
                const normalizedSizes = tamanhos.map(s => s.toUpperCase().trim());
                const isOnlyPP = normalizedSizes.length === 1 && normalizedSizes[0] === 'PP';
                const isOnlyGG = normalizedSizes.length === 1 && normalizedSizes[0] === 'GG';

                if (isOnlyPP || isOnlyGG) {
                    return null; // Reject clothing items with only PP or only GG
                }
            }

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
            else if (fullText.includes('casaco') || fullText.includes('jaqueta') || fullText.includes('blazer')) categoria = 'casaco';

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
                                    if (itm.sellers && itm.sellers[0] && itm.sellers[0].commertialOffer.AvailableQuantity > 0) {
                                        let sName = itm.name;
                                        if (sName.includes('/')) {
                                            sName = sName.split('/').pop().trim();
                                        } else if (sName.includes(' - ')) {
                                            sName = sName.split(' - ').pop().trim();
                                        }

                                        if (sName.length <= 4) {
                                            tamanhos.push(sName.toUpperCase());
                                        }
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

module.exports = { parseProductDressTo, fetchViaVtexAPI };
