const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');
const DEBUG_DIR = path.join(__dirname, 'debug');

/**
 * Parser Otimizado com Filtros Inteligentes
 * Filosofia: "Maximizar aproveitamento real, minimizar falsos positivos"
 * @param {string} url 
 */
async function parseProduct(url) {
    // VALIDAÇÃO ESTRITA DE URL (PRÉ-NAVEGAÇÃO)
    // Só processar URLs de produto real
    if (!url.includes('/p?') && !url.includes('/p/')) {
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

            // 2. PREÇO ORIGINAL (SELETOR ESPECÍFICO)
            const listPriceEl = document.querySelector('span#list-price');
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
            // Procura por elementos visíveis com R$ que NÃO sejam:
            // - #list-price (já capturado)
            // - parcelamento
            const allEls = Array.from(document.querySelectorAll('*'));
            const priceCandidates = allEls.filter(el => {
                if (el.children.length > 0) return false;
                if (el.id === 'list-price') return false; // Ignora o original

                const txt = getSafeText(el);
                if (!txt || !txt.includes('R$')) return false;

                // Filtro de parcelamento
                if (/x\s*de\s*R\$|parcel|sem\s+juros|ou\s+\d+x/i.test(txt)) return false;

                const isVisible = (el.offsetWidth > 0 && el.offsetHeight > 0);
                return isVisible;
            });

            const currentPrices = [];
            priceCandidates.forEach(el => {
                const txt = getSafeText(el);
                const match = txt.match(/R\$\s*([\d\.]+,\d{2})/);
                if (match) {
                    const valStr = match[1].replace(/\./g, '').replace(',', '.');
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > 0) {
                        currentPrices.push(val);
                    }
                }
            });

            // Remove duplicatas e pega o menor (geralmente é o preço à vista)
            const uniqueCurrentPrices = [...new Set(currentPrices)].sort((a, b) => a - b);
            const precoAtual = uniqueCurrentPrices.length > 0 ? uniqueCurrentPrices[0] : null;

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

            // Se não houver preço original, não é promoção
            if (!precoOriginal) return { error: 'Sem preço original (#list-price não encontrado)', debugInfo };

            // VALIDAÇÃO DE DESCONTO (FLEXÍVEL)
            // Desconto mínimo de R$5 para evitar falsos negativos por arredondamento
            const desconto = precoOriginal - precoAtual;
            if (desconto < 5) {
                return { error: `Desconto insuficiente (R$${desconto.toFixed(2)})`, debugInfo };
            }

            // 4. TAMANHOS
            const sizeSelectors = [
                '.vtex-store-components-3-x-skuSelectorItem',
                'div[class*="skuSelector"]',
                'label'
            ];

            const potentialSizes = Array.from(document.querySelectorAll(sizeSelectors.join(',')));
            const validSizes = [];
            const sizeRegex = /^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i;

            potentialSizes.forEach(el => {
                const txt = getSafeText(el).toUpperCase();
                if (!sizeRegex.test(txt)) return;

                const classStr = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
                const isDisabled = classStr.includes('unavailable') ||
                    classStr.includes('disable') ||
                    el.getAttribute('aria-disabled') === 'true';

                const isVisible = (el.offsetWidth > 0);

                if (!isDisabled && isVisible) {
                    validSizes.push(txt);
                }
            });

            const uniqueSizes = [...new Set(validSizes)];
            if (uniqueSizes.length === 0) return { error: 'Sem tamanhos habilitados', debugInfo };

            // 🚫 VALIDAÇÃO: Rejeitar roupas que só têm PP ou só têm GG (se houver PP+GG é válido)
            const clothingCategoriesList = ['vestido', 'macacão', 'saia', 'short', 'blusa', 'calça', 'macaquinho', 'conjunto', 'casaco', 'top/body', 'banho'];
            if (clothingCategoriesList.includes(category)) {
                const isOnlyPP = uniqueSizes.length === 1 && uniqueSizes[0] === 'PP';
                const isOnlyGG = uniqueSizes.length === 1 && uniqueSizes[0] === 'GG';

                if (isOnlyPP || isOnlyGG) {
                    return { error: `Apenas um tamanho extremo disponível (${uniqueSizes.join(', ')}) - necessário mais opções`, debugInfo };
                }
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

            return {
                data: {
                    nome: name,
                    precoOriginal: precoOriginal,
                    precoAtual: precoAtual,
                    tamanhos: uniqueSizes,
                    categoria: category
                },
                debugInfo: debugInfo
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
