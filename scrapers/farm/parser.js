const { initBrowser } = require('../../browser_setup');
const fs = require('fs');
const path = require('path');
const DEBUG_DIR = path.join(__dirname, '../../debug');

/**
 * Parser Otimizado com Filtros Inteligentes
 * Filosofia: "Maximizar aproveitamento real, minimizar falsos positivos"
 * @param {string} url 
 */
async function parseProduct(url) {
    // VALIDAÇÃO ESTRITA DE URL (PRÉ-NAVEGAÇÃO)
    // Só processar URLs de produto real (/p, /p/ ou /p?)
    if (!url.includes('/p?') && !url.includes('/p/') && !url.endsWith('/p')) {
        console.log(`⏭️ [Skip] URL não é produto: ${url}`);
        return null;
    }

    console.log(`--- [Optimized] Analisando: ${url} ---`);
    const { browser, page } = await initBrowser();

    try {
        // NAVEGAÇÃO
        try {
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 45000
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
            const h1 = document.querySelector('h1');
            const name = getSafeText(h1);
            if (!name) return { error: 'Nome não encontrado' };

            // 2. PREÇO ORIGINAL (SELETOR ESPECÍFICO + CLASS FALLBACK)
            let listPriceEl = document.querySelector('span#list-price');
            if (!listPriceEl) {
                // Fallback para a classe de preço riscado vista na inspeção
                listPriceEl = document.querySelector('.line-through');
            }

            let precoOriginal = null;
            let listPriceRaw = '';

            if (listPriceEl) {
                listPriceRaw = getSafeText(listPriceEl);
                // Regex flexível: aceita com ou sem centavos
                // R$ 1.698,00 ou R$ 1.698 ou R$ 449,99
                const match = listPriceRaw.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1];
                    // Remove pontos de milhar
                    valStr = valStr.replace(/\./g, '');
                    // Se tiver vírgula, substitui por ponto
                    if (valStr.includes(',')) {
                        valStr = valStr.replace(',', '.');
                    }
                    // Se não tiver centavos, adiciona .00
                    if (!valStr.includes('.')) {
                        valStr = valStr + '.00';
                    }
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0) {
                        precoOriginal = val;
                    }
                }
            }

            // 3. PREÇO ATUAL (BUSCA INTELIGENTE)
            // Prioridade: Elementos com classe de destaque ou no mesmo container que o listPrice
            let currentPrices = [];

            // Tenta primeiro a classe de destaque vista na inspeção
            const warningPriceEl = document.querySelector('.text-warning-content');
            if (warningPriceEl) {
                const txt = getSafeText(warningPriceEl);
                const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                if (match) {
                    let valStr = match[1].replace(/\./g, '');
                    if (valStr.includes(',')) valStr = valStr.replace(',', '.');
                    else valStr = valStr + '.00';
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0) {
                        currentPrices.push(val);
                    }
                }
            }

            if (listPriceEl && currentPrices.length === 0) {
                const container = listPriceEl.closest('div, p, span.vtex-product-price-1-x-price-list') || listPriceEl.parentElement;
                if (container) {
                    const localPrices = Array.from(container.querySelectorAll('*'))
                        .filter(el => {
                            if (el.children.length > 0) return false;
                            if (el === listPriceEl) return false;
                            const txt = getSafeText(el);
                            return txt && txt.includes('R$') && !/x\s*de|parcel|sem\s*juros|ou\s+\d+x/i.test(txt);
                        });

                    localPrices.forEach(el => {
                        const txt = getSafeText(el);
                        const match = txt.match(/R\$\s*([\d\.]+(?:,\d{2})?)/);
                        if (match) {
                            let valStr = match[1].replace(/\./g, '');
                            if (valStr.includes(',')) valStr = valStr.replace(',', '.');
                            else valStr = valStr + '.00';
                            const val = parseFloat(valStr);
                            if (!isNaN(val) && val > 0 && (!precoOriginal || val < precoOriginal)) {
                                currentPrices.push(val);
                            }
                        }
                    });
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
                    // CRITICAL: Exclude promotional text patterns
                    // Patterns like "50% off", "1 peça 50", "2 peças 100", etc.
                    if (/%\s*(off|desconto)/i.test(txt)) return false;
                    if (/\d+\s*peças?\s*\d+/i.test(txt)) return false;
                    if (/x\s*de\s*R\$|parcel|sem\s+juros|ou\s+\d+x/i.test(txt)) return false;
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

            // 4. TAMANHOS (Sincronização Refinada)
            const sizeContainers = Array.from(document.querySelectorAll('li.group\\/zoom-sku, [class*=\"skuSelector\"], .size-item, .vtex-store-components-3-x-skuSelectorItem'));
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

            // FALLBACK PARA TAMANHOS: Se não achou nada mas o produto existe, coloca 'UN' para não perder a peça
            if (uniqueSizes.length === 0) {
                console.log('⚠️ Nenhum tamanho detectado, assumindo UN');
                uniqueSizes = ['UN'];
            }

            // 5. CATEGORIA (INFERÊNCIA INTELIGENTE)
            let category = 'outros';
            const url = window.location.href.toLowerCase();

            // Prioridade 1: URL do produto
            if (url.includes('/vestido-')) category = 'vestido';
            else if (url.includes('/macacao-') || url.includes('/macaquinho-')) category = 'macacão';
            else if (url.includes('/saia-')) category = 'saia';
            else if (url.includes('/short-')) category = 'short';
            else if (url.includes('/blusa-') || url.includes('/camisa-')) category = 'blusa';
            else if (url.includes('/calca-')) category = 'calça';
            else {
                // Fallback: texto do body
                const bodyText = getSafeText(document.body).substring(0, 3000).toLowerCase();
                if (bodyText.includes('vestido')) category = 'vestido';
                else if (bodyText.includes('macacão') || bodyText.includes('macaquinho')) category = 'macacão';
                else if (bodyText.includes('saia')) category = 'saia';
                else if (bodyText.includes('short')) category = 'short';
                else if (bodyText.includes('blusa') || bodyText.includes('camisa')) category = 'blusa';
                else if (bodyText.includes('calça')) category = 'calça';
            }

            // 6. ID (Referência)
            let id = 'unknown';
            const refEl = document.querySelector('.vtex-product-identifier, .productReference, .vtex-product-identifier--product-reference');
            if (refEl) {
                const rawId = getSafeText(refEl).replace(/\D/g, '');
                if (rawId.length >= 6) id = rawId.substring(0, 6);
                else id = rawId;
            } else {
                // Fallback URL: tenta pegar os primeiros 6 dígitos do SKU
                const urlMatch = window.location.href.match(/(\d{6,})/);
                if (urlMatch) id = urlMatch[1].substring(0, 6);
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

                        const bestImg = candidates.find(img => (img.currentSrc || img.src) && !(img.src || '').includes('svg'));
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
    } finally {
        await browser.close();
    }
}

module.exports = { parseProduct };
