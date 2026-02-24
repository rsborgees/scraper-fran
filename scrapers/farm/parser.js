const { initBrowser } = require('../../browser_setup');
const fs = require('fs');
const path = require('path');
const DEBUG_DIR = path.join(__dirname, '../../debug');



/**
 * Parser Otimizado com Filtros Inteligentes
 */
async function parseProduct(page, url) {
    // VALIDAÇÃO ESTRITA DE URL (PRÉ-NAVEGAÇÃO)
    // Só processar URLs de produto real (/p, /p/ ou /p?)
    if (!url.includes('/p?') && !url.includes('/p/') && !url.endsWith('/p')) {
        console.log(`⏭️ [Skip] URL não é produto: ${url}`);
        return null;
    }

    // FILTRO ANTI-INFANTIL (Fábula / Bento / Teen / Mini / Kids)
    if (/fabula|bento|teen|kids|infantil|brincando/i.test(url)) {
        console.log(`👶 [Skip] Produto Infantil detectado por URL: ${url}`);
        return null;
    }

    console.log(`\n🔎 Analisando: ${url.split('/').pop()}`);

    // Console Listener (Browser -> Node)
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[isForbidden]') || text.includes('[DEBUG]')) {
            console.log(`📺 [Browser Console] ${text}`);
        }
    });

    try {
        // NAVEGAÇÃO
        try {
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
        } catch (navError) {
            console.warn(`⚠️ [Nav] Timeout: ${navError.message}`);
        }

        // ESPERA
        try {
            await page.waitForSelector('h1', { timeout: 8000, state: 'visible' });
        } catch (e) { /* Ignora */ }

        // Screenshot
        const rawSlug = url.split('/').pop() || 'unknown';
        const slug = rawSlug.replace(/[^a-z0-9-_]/gi, '_');
        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        const screenshotPath = path.join(DEBUG_DIR, `domdriven_${slug}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 ${screenshotPath}`);

        // EXTRAÇÃO (SELETORES ESPECÍFICOS)
        const result = await page.evaluate(() => {
            const getSafeText = (el) => {
                if (!el) return '';
                const txt = el.innerText || el.textContent || '';
                return (typeof txt === 'string') ? txt.trim() : '';
            };

            // 1. NOME
            // Tenta seletor de classe específico primeiro, depois h1 genérico
            let nameEl = document.querySelector('.vtex-store-components-3-x-productNameContainer span') || document.querySelector('h1.vtex-store-components-3-x-productName') || document.querySelector('h1');
            let name = getSafeText(nameEl);

            // Validação de Nome
            if (!name || name.length < 3 || /^\d+(\n\d+)?$/.test(name)) {
                // Fallback para meta title
                const metaTitle = document.querySelector('meta[property="og:title"]');
                if (metaTitle && metaTitle.content) {
                    name = metaTitle.content.split('|')[0].trim();
                }
            }

            if (!name || name.length < 3 || /^\d+(\n\d+)?$/.test(name)) return { error: `Nome inválido detectado: "${name}"` };

            // 2. PREÇO ORIGINAL (#list-price)
            let precoOriginal = null;
            let listPriceRaw = '';

            const listPriceEl = document.querySelector('span#list-price');
            // Só considera o listPrice se ele estiver visível (style hidden desconsiderado)
            if (listPriceEl && (listPriceEl.offsetWidth > 0 || listPriceEl.offsetHeight > 0)) {
                listPriceRaw = getSafeText(listPriceEl);
                const match = listPriceRaw.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '').replace(',', '.');
                    if (!valStr.includes('.')) valStr = valStr + '.00';
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0) precoOriginal = val;
                }
            }

            // 3. PREÇO ATUAL (Prioridade Seletores VTEX)
            let currentPrices = [];

            const mainPriceSelectors = [
                'span#price',
                '.vtex-store-components-3-x-sellingPriceValue',
                '.vtex-product-price-1-x-sellingPriceValue',
                '.ns-product-price__value',
                '.product-prices__value'
            ];

            for (const sel of mainPriceSelectors) {
                const els = document.querySelectorAll(sel);
                for (const el of els) {
                    // Verificamos se NÃO está em uma vitrine (shelf/recommendation)
                    let area = el;
                    let isShelf = false;
                    while (area) {
                        const cls = (area.className || '').toString().toLowerCase();
                        const id = (area.id || '').toString().toLowerCase();
                        if (cls.includes('shelf') || cls.includes('recommendation') || cls.includes('vitrine')) {
                            isShelf = true;
                            break;
                        }
                        area = area.parentElement;
                    }
                    if (isShelf) continue;

                    const txt = getSafeText(el);
                    const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                    if (match) {
                        let valStr = match[1].replace(/\./g, '').replace(',', '.');
                        if (!valStr.includes('.')) valStr = valStr + '.00';
                        const val = parseFloat(valStr);
                        if (!isNaN(val) && val > 0) currentPrices.push(val);
                    }
                }
            }

            // Fallback para text-warning (destaque de promo) se o #price não foi conclusivo ou é o mesmo que o #list-price
            const warningPriceEl = document.querySelector('.text-warning-content');
            if (warningPriceEl) {
                const txt = getSafeText(warningPriceEl);
                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '').replace(',', '.');
                    if (valStr.includes(',')) valStr = valStr.replace(',', '.');
                    else valStr = valStr + '.00';
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0) {
                        currentPrices.push(val);
                    }
                }
            }

            // Fallback: Busca global se não encontrou no container
            if (currentPrices.length === 0) {
                const allEls = Array.from(document.querySelectorAll('*'));
                const priceCandidates = allEls.filter(el => {
                    const tag = el.tagName.toLowerCase();
                    if (tag === 'script' || tag === 'style' || tag === 'noscript') return false;
                    if (el.children.length > 0) return false;
                    if (el.id === 'list-price') return false;

                    const txt = getSafeText(el);
                    if (!txt || !txt.includes('R$')) return false;

                    // CRITICAL: Exclude promotional text patterns and ANY installment pattern
                    if (/%\s*(off|desconto|de desconto)/i.test(txt)) return false;
                    if (/\d+\s*peças?\s*\d+/i.test(txt)) return false;

                    // Improved installment detection: 
                    // Matches "6x de", "ou 6x", "parcelas", "sem juros", "vezes"
                    if (/\d+\s*x\s*de|parcel|sem\s*juros|ou\s*\d+x|vezes/i.test(txt)) return false;

                    // Check parent/grandparent for "juros" or "x" or "vezes"
                    let parent = el.parentElement;
                    let depth = 0;
                    while (parent && depth < 3) {
                        const pTxt = getSafeText(parent).toLowerCase();
                        if (pTxt.includes('juros') || /\d+x/i.test(pTxt) || pTxt.includes('vezes') || pTxt.includes('parcel')) return false;
                        parent = parent.parentElement;
                        depth++;
                    }

                    // Check if it's visible
                    if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;

                    // Avoid elements in common non-product areas by class/id
                    let area = el;
                    while (area) {
                        const cls = (area.className || '').toString().toLowerCase();
                        const id = (area.id || '').toString().toLowerCase();
                        if (cls.includes('shelf') || cls.includes('recommendation') || cls.includes('footer') || cls.includes('header') || cls.includes('related') || cls.includes('vitrine')) return false;
                        if (id.includes('shelf') || id.includes('recommendation') || id.includes('footer') || id.includes('header') || id.includes('related') || id.includes('vitrine')) return false;
                        area = area.parentElement;
                    }

                    return true;
                });

                priceCandidates.forEach(el => {
                    const txt = getSafeText(el);
                    const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                    if (match) {
                        let valStr = match[1].replace(/\./g, '');
                        if (valStr.includes(',')) valStr = valStr.replace(',', '.');
                        else valStr = valStr + '.00';
                        const val = parseFloat(valStr);
                        if (!isNaN(val) && val > 0) {
                            // Se tiver precoOriginal, o atual tem que ser menor
                            if (!precoOriginal || val < precoOriginal) {
                                currentPrices.push(val);
                            }
                        }
                    }
                });
            }

            // O preço atual é o primeiro encontrado no container (que geralmente é o selling price)
            // Se houver múltiplos, pegamos o menor para ser conservador
            const uniqueCurrentPrices = [...new Set(currentPrices)].sort((a, b) => a - b);

            // CRITICAL FILTER: Remove promotional values
            // If we have the exact pattern [50, 100, 200, 300, 399] or subset, it's from "Desconto Progressivo"
            const suspiciousPatterns = [50, 100, 150, 200, 250, 300, 350, 399, 400];
            const filteredPrices = uniqueCurrentPrices.filter(price => {
                // Se o preço é redondo/pequeno e existe o padrão de desconto progressivo na página
                if (suspiciousPatterns.includes(price)) {
                    const suspiciousCount = uniqueCurrentPrices.filter(p => suspiciousPatterns.includes(p)).length;
                    if (suspiciousCount >= 2) return false;
                }
                return true;
            });

            let precoAtual = null;
            if (filteredPrices.length > 0) {
                // Se temos precoOriginal, o atual não pode ser ABSURDAMENTE menor (ex: < 15% do preço)
                // Isso evita pegar o valor da parcela (ex: 1/6 do preço).
                if (precoOriginal) {
                    const minReasonable = precoOriginal * 0.15;
                    const reasonablePrices = filteredPrices.filter(p => p >= minReasonable);
                    if (reasonablePrices.length > 0) precoAtual = reasonablePrices[0];
                }

                if (!precoAtual) precoAtual = filteredPrices[0];
            }

            // Se ainda não achou precoAtual mas achamos UNIQUE PRICES, tenta o maior deles que NÃO seja suspeito
            if (!precoAtual && uniqueCurrentPrices.length > 0) {
                const nonSuspicious = uniqueCurrentPrices.filter(p => !suspiciousPatterns.includes(p));
                if (nonSuspicious.length > 0) precoAtual = nonSuspicious[0];
                else precoAtual = uniqueCurrentPrices[uniqueCurrentPrices.length - 1]; // Pega o maior como fallback
            }

            // DEBUG INFO
            const debugInfo = {
                listPriceRaw: listPriceRaw,
                listPriceFound: !!listPriceEl,
                precoOriginalParsed: precoOriginal,
                currentPricesFound: uniqueCurrentPrices,
                precoAtualSelected: precoAtual
            };

            // VALIDAÇÃO
            if (!precoAtual) return { error: 'Preço atual não encontrado', debugInfo };

            // Se não houver preço original, assume que é o preço atual (sem promoção)
            if (!precoOriginal) {
                precoOriginal = precoAtual;
            }

            // VALIDAÇÃO DE DESCONTO (FLEXÍVEL)
            const desconto = precoOriginal - precoAtual;
            if (desconto < 0) {
                precoOriginal = precoAtual;
            }


            // FILTRO BAZAR (Requisito: Se estiver no Bazar, NÃO envia, independente do desconto)
            const isBazar = (function () {
                // 1. URL Check
                if (window.location.href.toLowerCase().includes('bazar')) return true;

                // 2. Title Check
                if (document.title.toLowerCase().includes('bazar')) return true;

                // 3. Runtime Check (Vtex)
                if (window.__RUNTIME__ && window.__RUNTIME__.route && window.__RUNTIME__.route.path) {
                    if (window.__RUNTIME__.route.path.toLowerCase().includes('bazar')) return true;
                }

                // 4. Main Content Check (Careful: menu/footer might contain 'bazar')
                const mainEl = document.querySelector('.vtex-store-components-3-x-container') || document.querySelector('main');
                const relevantText = mainEl ? mainEl.innerText.substring(0, 1500).toLowerCase() : '';

                // Breadcrumb precise check is better
                const breadcrumbs = Array.from(document.querySelectorAll('.vtex-breadcrumb__container a, [class*="breadcrumb"] a'));
                if (breadcrumbs.some(b => b.innerText.toLowerCase().includes('bazar'))) return true;

                // Only matches if 'bazar' is a dominant part or in specificPDP context
                // Removed: relevantText.includes('bazar farm') as it's too broad
                if (relevantText.includes('categoria: bazar')) return true;

                return false;
            })();

            // 4. CATEGORIA E BLOQUEIOS
            let category = 'desconhecido';
            const urlLower = window.location.href.toLowerCase();
            const nameLower = name.toLowerCase();

            // Pega o texto do Breadcrumb se existir
            const breadcrumbEl = document.querySelector('.vtex-breadcrumb__container') || document.querySelector('[class*="breadcrumb"]');
            const breadcrumbText = breadcrumbEl ? getSafeText(breadcrumbEl).toLowerCase() : '';

            // Strict Text: Apenas áreas que REALMENTE definem o produto
            const strictText = (urlLower + ' ' + nameLower + ' ' + breadcrumbText);

            // DEFINIÇÃO DE CATEGORIAS (PRIORIDADE NO STRICT TEXT)
            if (strictText.includes('/vestido') || strictText.includes('vestido')) category = 'vestido';
            else if (strictText.includes('/macacao') || strictText.includes('/macaquinho') || strictText.includes('macacão') || strictText.includes('macaquinho')) category = 'macacão';
            else if (strictText.includes('/conjunto') || strictText.includes('conjunto')) category = 'conjunto';
            else if (strictText.includes('/saia') || strictText.includes('saia')) category = 'saia';
            else if (strictText.includes('/short') || strictText.includes('short') || strictText.includes('bermuda')) category = 'short';
            else if (strictText.includes('/calca') || strictText.includes('calça') || strictText.includes('pantacourt')) category = 'calça';
            else if (strictText.includes('/blusa') || strictText.includes('/camisa') || strictText.includes('/t-shirt') || strictText.includes('blusa') || strictText.includes('camisa') || strictText.includes('t-shirt')) category = 'blusa';
            else if (strictText.includes('/casaco') || strictText.includes('/jaqueta') || strictText.includes('/moletom') || strictText.includes('casaco') || strictText.includes('jaqueta') || strictText.includes('moletom')) category = 'casaco';
            else if (strictText.includes('/body') || strictText.includes('/kimono') || strictText.includes('/top') || strictText.includes('/colete') || strictText.includes('body') || strictText.includes('kimono') || strictText.includes('top') || strictText.includes('colete')) category = 'top/body';
            else if (strictText.includes('/biquini') || strictText.includes('/maio') || strictText.includes('biquíni') || strictText.includes('maiô') || strictText.includes('biquini') || strictText.includes('maio')) category = 'banho';

            // BLOQUEIO EXPLÍCITO DE CATEGORIAS PROIBIDAS (Usando STRICT TEXT para evitar menu/footer)
            const isForbidden = (function () {
                // Acessórios / Malas
                if (/\/mala(-|\/)/i.test(strictText) || /\bmala\b/i.test(strictText)) return 'mala';
                if (/mochila/i.test(strictText) || /rodinha/i.test(strictText)) return 'mala';

                if (/\/brinco-/i.test(strictText) || /\/bolsa(-|\/|\?)/i.test(strictText) || /\bbolsa\b/i.test(strictText) || /\/colar-/i.test(strictText) || /\/cinto-/i.test(strictText) || (/\/acessorio-/i.test(strictText) && !strictText.includes('acessorio-feminino')) || /\bbrinco\b/i.test(strictText) || /\bcolar\b/i.test(strictText) || /\bacessório\b/i.test(strictText) || /\bnecessaire\b/i.test(strictText) || /\bóculos\b/i.test(strictText) || /\bscrunchie\b/i.test(strictText) || /\btiara\b/i.test(strictText) || /\blenço\b/i.test(strictText) || /\bpochete\b/i.test(strictText) || /\bcarteira\b/i.test(strictText) || /\bchaveiro\b/i.test(strictText) || /\bmeia\b/i.test(strictText) || /\bluva\b/i.test(strictText) || /\bcachecol\b/i.test(strictText) || /\btouca\b/i.test(strictText) || /\bboné\b/i.test(strictText) || /\bchapéu\b/i.test(strictText)) return 'acessório';

                // Roupas de Banho
                // REMOVIDO: Deixando passar banho (biquinis/maiôs) conforme pedido do usuário

                // Garrafas / Copos / Casa
                if (/\/garrafa-/i.test(strictText) || /\/copo-/i.test(strictText) || /\/squeeze-/i.test(strictText) || /\/marmita-/i.test(strictText) || /\/caneca-/i.test(strictText) || /\bgarrafa\b/i.test(strictText) || /\bcopo\b/i.test(strictText) || /\bsqueeze\b/i.test(strictText) || /\bmarmita\b/i.test(strictText) || /\bcaneca\b/i.test(strictText) || /\bkit\b/i.test(strictText) || /\bvela\b/i.test(strictText) || /\bcaderno\b/i.test(strictText) || /\badesivo\b/i.test(strictText) || /\bestojo\b/i.test(strictText) || /\bbeauty\b/i.test(strictText)) return 'utilitário/casa';

                return null;
            })();

            if (isForbidden && category === 'desconhecido') {
                return { error: `${isForbidden.charAt(0).toUpperCase() + isForbidden.slice(1)} bloqueado(a)` };
            }

            // 🚫 BLOQUEIO DE CATEGORIA DESCONHECIDA (Se não é uma das roupas permitidas, bloqueia)
            if (category === 'desconhecido') {
                return { error: 'Categoria não identificada ou não permitida (Bloqueio Preventivo)' };
            }

            // --- REGRA DE DESCONTO ---
            // REGRA PADRÃO: 10% extra em roupas sem promoção
            const clothingCategories = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'calça', 'macaquinho'];
            const isNoPromoClothing = clothingCategories.includes(category) && (precoOriginal === precoAtual);

            if (precoAtual > 0 && isNoPromoClothing) {
                const precoComDescontoExtra = parseFloat((precoAtual * 0.90).toFixed(2));
                console.log(`🎉 [PROMO] Aplicando 10% off (Roupa sem promo): De R$${precoAtual} para R$${precoComDescontoExtra}`);
                precoAtual = precoComDescontoExtra;
            }
            // -----------------------------------------------------

            // 5. TAMANHOS (Sincronização Refinada)
            const sizeContainers = Array.from(document.querySelectorAll('li.group\\/zoom-sku, [class*="skuSelector"], .size-item, .vtex-store-components-3-x-skuSelectorItem'));
            const validSizes = [];

            sizeContainers.forEach(container => {
                const label = container.querySelector('label, button') || container;
                if (!label) return;

                let txt = getSafeText(label).toUpperCase();
                txt = txt.replace(/TAMANHO|TAM|[:]/g, '').trim();

                const match = txt.match(/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i);
                if (!match) return;

                const normalizedSize = match[0].toUpperCase();

                // CRITÉRIOS DE DISPONIBILIDADE (Mais relaxado para garantir cota)
                const classStr = (label.getAttribute('class') || '').toLowerCase() + (container.getAttribute('class') || '').toLowerCase();
                const hasDiagonalLine = classStr.includes('after:rotate') || classStr.includes('rotate-45') || classStr.includes('disabled');
                const containerText = container.innerText.toLowerCase();
                const hasNotifyMe = containerText.includes('avise-me') || containerText.includes('me avise');

                if (!hasDiagonalLine && !hasNotifyMe) {
                    validSizes.push(normalizedSize);
                }
            });

            let uniqueSizes = [...new Set(validSizes)];

            // FALLBACK PARA TAMANHOS
            if (uniqueSizes.length === 0) {
                // SÓ assume UN se for acessório ou categoria desconhecida que não parece roupa
                const clothingCategoriesList = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'calça', 'macaquinho'];

                if (clothingCategoriesList.includes(category)) {
                    // É roupa e não tem tamanho -> Provavelmente ESGOTADO
                    return { error: `Produto ESGOTADO (Sem tamanhos disponíveis para ${category})` };
                } else {
                    console.log(`⚠️ Nenhum tamanho detectado para ${category}, assumindo UN (Acessório/Outros)`);
                    uniqueSizes = ['UN'];
                }
            }

            // 🚫 VALIDAÇÃO: Rejeitar roupas que só têm PP ou só têm GG (se houver PP+GG é válido)
            const clothingCategoriesList = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'calça', 'macaquinho', 'conjunto', 'casaco', 'top/body', 'banho'];
            if (clothingCategoriesList.includes(category)) {
                const uniqueSizesNormalized = uniqueSizes.map(s => s.toUpperCase().trim());

                const isOnlyPP = uniqueSizesNormalized.length === 1 && uniqueSizesNormalized[0] === 'PP';
                const isOnlyGG = uniqueSizesNormalized.length === 1 && uniqueSizesNormalized[0] === 'GG';

                if (isOnlyPP || isOnlyGG) {
                    return { error: `Apenas um tamanho extremo disponível (${uniqueSizes.join(', ')}) - necessário mais opções` };
                }
            }

            // CHECK FINAL: Validação Rigorosa de Tamanho (Adulto vs Infantil)
            const isAdultSize = (sizes) => {
                const adultMarkers = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'UN', 'ÚNICO', '34', '36', '38', '40', '42', '44', '46', '48', '50'];
                // Se array contém pelo menos UM marcador adulto, é considerado adulto
                return sizes.some(s => adultMarkers.includes(s));
            };

            const isKidsSizeOnly = (sizes) => {
                // Tamanhos numéricos pequenos (2 a 16)
                const kidsMarkers = ['2', '4', '6', '8', '10', '12', '14', '16'];
                // Retorna true se TODOS os tamanhos encontrados forem infantis
                return sizes.length > 0 && sizes.every(s => kidsMarkers.includes(s));
            };

            // Lógica de Rejeição
            if (isKidsSizeOnly(uniqueSizes)) {
                return { error: `Produto Infantil detectado (Grade somente infantil: ${uniqueSizes.join(',')})` };
            }

            if (!isAdultSize(uniqueSizes) && /fábula|fabula|bento|teen|infantil|kids/i.test(name)) {
                return { error: 'Produto Infantil detectado (Nome + Grade não-adulta)' };
            }

            // Reforço: Se contiver 'bento' ou 'fábula' explicitamente, mata
            if (/bento|fábula|fabula/i.test(name)) {
                return { error: 'Produto Infantil detectado (Marca proibida no nome)' };
            }

            // 6. ID (Referência)
            let id = 'unknown';
            const refEl = document.querySelector('.vtex-product-identifier, .productReference, .vtex-product-identifier--product-reference');
            if (refEl) {
                const rawId = getSafeText(refEl);
                // Tenta extrair padrão com cor primeiro (XXXXXX_YYYY ou XXXXXX-YYYY)
                const compositeMatch = rawId.match(/(\d{6,}[_-]\d+)/);
                if (compositeMatch) {
                    id = compositeMatch[1].replace(/-/g, '_'); // Normaliza hífen para underscore
                } else {
                    // Fallback: apenas números
                    const numericId = rawId.replace(/\D/g, '');
                    if (numericId.length >= 6) id = numericId;
                    else if (numericId.length > 0) id = numericId;
                }
            }


            if (id === 'unknown') {
                // Fallback URL: tenta pegar código completo incluindo cor
                // Padrão Farm: /produto-nome-CODIGO1-CODIGO2/p
                const urlPattern = window.location.href.match(/(\d{6,})-(\d+)\/p/);
                if (urlPattern) {
                    id = `${urlPattern[1]}_${urlPattern[2]}`; // Ex: 357793_51202
                } else {
                    // Fallback simples: primeiros 6+ dígitos
                    const urlMatch = window.location.href.match(/(\d{6,}[_-]\d+|\d{6,})/);
                    if (urlMatch) {
                        id = urlMatch[1].replace(/-/g, '_');
                    } else {
                        // Fallback Final: Hash da URL (pathname)
                        // Garante unicidade para produtos sem ID explícito no DOM/URL
                        let hash = 0;
                        const str = window.location.pathname;
                        for (let i = 0; i < str.length; i++) {
                            const char = str.charCodeAt(i);
                            hash = ((hash << 5) - hash) + char;
                            hash |= 0; // Convert to 32bit integer
                        }
                        id = Math.abs(hash).toString();
                    }
                }
            }

            return {
                data: {
                    id: id,
                    nome: name,
                    precoOriginal: precoOriginal,
                    precoAtual: precoAtual,
                    tamanhos: uniqueSizes,
                    categoria: category,
                    bazar: isBazar,
                    imageUrl: (function () {
                        const gallerySelectors = [
                            '.pixel-image',
                            '.product-image',
                            '.vtex-store-components-3-x-productImageTag',
                            '.swiper-slide-active img',
                            '.image-gallery img',
                            'img[data-zoom]'
                        ];

                        let candidates = [];
                        for (const sel of gallerySelectors) {
                            const els = document.querySelectorAll(sel);
                            if (els.length > 0) candidates.push(...Array.from(els));
                        }
                        if (candidates.length === 0) {
                            // Farm often uses large images in grids
                            candidates = Array.from(document.querySelectorAll('img'))
                                .filter(img => img.width > 300 && img.height > 300);
                        }

                        // Extract meta image as backup
                        const ogImg = document.querySelector('meta[property="og:image"]');
                        if (candidates.length === 0 && ogImg && ogImg.content) return ogImg.content;

                        const bestImg = candidates.find(img => {
                            const src = img.currentSrc || img.src;
                            if (!src) return false;
                            const srcLower = src.toLowerCase();
                            // CHECK STRICT: Reject cookie logos or common bad images
                            if (srcLower.includes('cookielaw') || srcLower.includes('onetrust') || srcLower.includes('svg') || srcLower.includes('icon')) return false;
                            return true;
                        });
                        return bestImg ? (bestImg.currentSrc || bestImg.src) : (ogImg ? ogImg.content : null);
                    })()
                },
                debugInfo: { ...debugInfo, sizeDebugs: window.sizeDebugs }
            };
        });

        // DEBUG LOGS
        if (result.debugInfo) {
            console.log(`[DEBUG] #list-price encontrado: ${result.debugInfo.listPriceFound}`);
            console.log(`[DEBUG] #list-price texto: "${result.debugInfo.listPriceRaw}"`);
            console.log(`[DEBUG] Preço Original parseado: ${result.debugInfo.precoOriginalParsed}`);
            console.log(`[DEBUG] Preços Atuais encontrados: [${result.debugInfo.currentPricesFound.join(', ')}]`);
            console.log(`[DEBUG] Preço Atual selecionado: ${result.debugInfo.precoAtualSelected}`);
        }

        if (result.error) {
            console.log(`❌ [DOMDriven] Descartado: ${result.error}`);
            return null;
        }

        const finalProduct = { ...result.data, url: url };
        console.log(`✅ [DOMDriven] VÁLIDO: ${finalProduct.nome} | R$${finalProduct.precoOriginal}->R$${finalProduct.precoAtual}`);
        return finalProduct;

    } catch (error) {
        console.error(`💀 [DOMDriven] Erro: ${error.message}`);
        return null;
    }
}

module.exports = { parseProduct };
