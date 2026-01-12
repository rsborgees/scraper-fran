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
    if (/fabula|bento|teen|mini|kids|infantil|brincando/i.test(url)) {
        console.log(`👶 [Skip] Produto Infantil detectado por URL: ${url}`);
        return null;
    }

    console.log(`\n🔎 Analisando: ${url.split('/').pop()}`);

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

            // 3. PREÇO ATUAL (Prioridade #price)
            let currentPrices = [];

            // Tenta o seletor oficial de preço de venda
            const priceEl = document.querySelector('span#price');
            if (priceEl) {
                const txt = getSafeText(priceEl);
                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '').replace(',', '.');
                    if (!valStr.includes('.')) valStr = valStr + '.00';
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0) currentPrices.push(val);
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
                    if (el.children.length > 0) return false;
                    if (el.id === 'list-price') return false;
                    const txt = getSafeText(el);
                    if (!txt || !txt.includes('R$')) return false;
                    // CRITICAL: Exclude promotional text patterns and ANY installment pattern
                    if (/%\s*(off|desconto)/i.test(txt)) return false;
                    if (/\d+\s*peças?\s*\d+/i.test(txt)) return false;
                    if (/\d+\s*x\s*de|parcel|sem\s*juros|ou\s*\d+x/i.test(txt)) return false;
                    return (el.offsetWidth > 0 && el.offsetHeight > 0);
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

            let precoAtual = filteredPrices.length > 0 ? filteredPrices[0] : null;

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

                // 4. Breadcrumb / Main Content Check
                // Avoid Footer/Header by targetting 'main' or specific classes, or just top of body text
                const mainEl = document.querySelector('.vtex-store-components-3-x-container') || document.querySelector('main') || document.body;
                // Limit text search to first 2000 chars to avoid hitting footer
                const relevantText = mainEl.innerText.substring(0, 3000).toLowerCase();

                // Specific patterns seen in Bazar
                if (relevantText.includes('bazar farm') || relevantText.includes('bazar 50%')) return true;

                // Breadcrumb precise check
                const breadcrumbs = Array.from(document.querySelectorAll('a')).filter(a => {
                    // Filter anchors inside known breadcrumb containers or just high up in DOM
                    return a.closest('.vtex-breadcrumb') || a.closest('[data-testid="breadcrumb"]');
                });
                if (breadcrumbs.some(b => b.innerText.toLowerCase().includes('bazar'))) return true;

                return false;
            })();

            // if (isBazar) {
            //     const msg = `Produto descartado (Detectado como BAZAR)`;
            //     console.log(`⚠️ ${msg}`);
            //     return { error: msg, debugInfo };
            // }

            // FILTRO DE DESCONTO: REMOVIDO (Usuário liberou qualquer desconto se não for Bazar)
            // if (percentualDesconto > 45) ... (DELETED)


            // 4. CATEGORIA (Antecipado para ajudar na validação de tamanho)
            let category = 'outros';
            const urlLower = window.location.href.toLowerCase();
            const bodyText = getSafeText(document.body).substring(0, 3000).toLowerCase();
            const combinedText = (urlLower + ' ' + bodyText);

            if (combinedText.includes('/vestido-') || combinedText.includes(' vestido ')) category = 'vestido';
            else if (combinedText.includes('/macacao-') || combinedText.includes('/macaquinho-') || combinedText.includes(' macacão ') || combinedText.includes(' macaquinho ')) category = 'macacão';
            else if (combinedText.includes('/saia-') || combinedText.includes(' saia ')) category = 'saia';
            else if (combinedText.includes('/short-') || combinedText.includes(' short ')) category = 'short';
            else if (combinedText.includes('/blusa-') || combinedText.includes('/camisa-') || combinedText.includes(' blusa ') || combinedText.includes(' camisa ')) category = 'blusa';
            else if (combinedText.includes('/brinco-') || combinedText.includes('/bolsa-') || combinedText.includes('/colar-') || combinedText.includes('/cinto-') || combinedText.includes('/acessorio-') || combinedText.includes(' brinco ') || combinedText.includes(' bolsa ') || combinedText.includes(' colar ') || combinedText.includes(' acessório ') || combinedText.includes(' garrafa ') || combinedText.includes(' copo ') || combinedText.includes(' necessaire ')) category = 'acessório';
            else if (combinedText.includes('/calca-') || combinedText.includes(' calça ')) category = 'calça';

            // 🚫 BLOQUEIO TOTAL DE ACESSÓRIOS
            if (category === 'acessório') {
                return { error: 'Acessório bloqueado (Garrafas, Copos, Bolsas e similares)' };
            }

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
                const clothingCategories = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'calça', 'macaquinho'];

                if (clothingCategories.includes(category)) {
                    // É roupa e não tem tamanho -> Provavelmente ESGOTADO
                    return { error: `Produto ESGOTADO (Sem tamanhos disponíveis para ${category})` };
                } else {
                    console.log(`⚠️ Nenhum tamanho detectado para ${category}, assumindo UN (Acessório/Outros)`);
                    uniqueSizes = ['UN'];
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
                const rawId = getSafeText(refEl).replace(/\D/g, '');
                if (rawId.length >= 6) id = rawId.substring(0, 6);
                else if (rawId.length > 0) id = rawId;
            }

            if (id === 'unknown') {
                // Fallback URL: tenta pegar os primeiros 6 dígitos do SKU
                const urlMatch = window.location.href.match(/(\d{6,})/);
                if (urlMatch) {
                    id = urlMatch[1].substring(0, 6);
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

            return {
                data: {
                    id: id,
                    nome: name,
                    precoOriginal: precoOriginal,
                    precoAtual: precoAtual,
                    tamanhos: uniqueSizes,
                    categoria: category,
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
