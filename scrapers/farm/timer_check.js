const { initBrowser } = require('../../browser_setup');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const DEBUG_DIR = path.join(__dirname, '../../debug');
const DATA_DIR = path.join(__dirname, '../../data');
const STATE_FILE = path.join(DATA_DIR, 'reloginho_state.json');
const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/reloginho';

/**
 * Verifica se há um cronômetro de desconto na home da Farm Rio.
 */
async function checkFarmTimer() {
    console.log(`[${new Date().toISOString()}] 🔍 Verificando cronômetro na Farm Rio...`);
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.farmrio.com.br/novidades', {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        // Espera banners dinâmicos carregarem
        await page.waitForTimeout(5000);

        // Screenshot para debug
        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        const screenshotPath = path.join(DEBUG_DIR, `timer_check_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath });

        const timerData = await page.evaluate(() => {
            const getSafeText = (el) => el ? (el.innerText || el.textContent || '').trim() : '';

            // 1. Verificação VISUAL de Timer Ativo
            // Procura por container que contenha "faltam" ou "acaba em" e dígitos de tempo
            const allElements = Array.from(document.querySelectorAll('div, section, header p'));
            const timerContainer = allElements.find(el => {
                const txt = getSafeText(el).toLowerCase();
                // O cronômetro da Farm costuma ter "faltam" e divisores ":" 
                // Mesmo que os números não apareçam no innerText (devido a CSS vars), os labels "hora", "minutos" costumam estar.
                const hasKeywords = txt.includes('faltam') || txt.includes('acaba em');
                const hasStructure = txt.includes(':') && (txt.includes('hora') || txt.includes('minutos') || txt.includes('seg') || /\d{2}/.test(txt));
                return hasKeywords && hasStructure;
            });

            if (!timerContainer) {
                return { encontrado: false };
            }

            // 2. Extração do Tempo (Busca números dentro do container encontrado)
            const bannerText = getSafeText(timerContainer);
            let timeStr = null;

            // Procura spans com a variável CSS --value (padrão DaisyUI/Tailwind comum na Farm)
            // Filtra manualmente pois querySelector com seletores de atributo as vezes falha com variáveis CSS
            const valueSpans = Array.from(timerContainer.querySelectorAll('span')).filter(s => {
                return s.style.getPropertyValue('--value') ||
                    (s.getAttribute('style') && s.getAttribute('style').includes('--value'));
            });

            if (valueSpans.length >= 2) {
                const vals = valueSpans.map(s => {
                    const val = s.style.getPropertyValue('--value').trim() || (s.getAttribute('style').match(/--value:\s*(\d+)/)?.[1]);
                    return val ? val.padStart(2, '0') : '00';
                });
                timeStr = vals.join(':');
            } else {
                // Fallback 1: Tenta HH:MM:SS no texto
                const hmsMatch = bannerText.match(/(\d{2})\s*:\s*(\d{2})\s*:\s*(\d{2})/);
                if (hmsMatch) {
                    timeStr = `${hmsMatch[1]}:${hmsMatch[2]}:${hmsMatch[3]}`;
                } else {
                    // Fallback 2: Tenta formato "00 hora 54 minutos..."
                    const numbers = bannerText.match(/(\d{1,2})\s*(?:h|hora|min|seg|s)/g);
                    if (numbers && numbers.length >= 2) {
                        const cleanNums = numbers.map(s => s.replace(/\D/g, '').padStart(2, '0'));
                        timeStr = cleanNums.join(':');
                    }
                }
            }
            // Fallback se achou o container mas não o tempo exato: placeholder
            if (!timeStr) timeStr = "EM BREVE";


            // 3. Busca Cupom/Desconto (Varredura no header/banner)
            const fullText = document.body.innerText; // Usa texto completo para garantir
            let discountCode = null;
            let discountPercent = null;

            // Busca código explícito (ex: "Cupom\nQUERO25" ou "Cupom: QUERO25")
            // A quebra de linha \s pega novos, mas vamos ser específicos
            const cupomRegex = /(?:CUPOM|CÓDIGO|USE)[\s\n\r]*[:]?[\s\n\r]*([A-Z0-9]{4,})/i;
            const cupomMatch = fullText.match(cupomRegex);
            if (cupomMatch) {
                const candidate = cupomMatch[1].toUpperCase();
                // Filtra indesejados
                if (!['DIA', 'HOJE', 'SALE', 'AGORA', 'APLICAR'].includes(candidate)) {
                    discountCode = candidate;
                }
            }

            // Busca porcentagem de destaque
            // Prioridade 1: Dentro do container do timer (banner principal)
            // Tenta achar a porcentagem que está mais próxima do texto "faltam" ou no mesmo banner
            const allPercsInBanner = bannerText.match(/(\d{1,2}\s*%)/g);
            if (allPercsInBanner && allPercsInBanner.length > 0) {
                // Se houver "20%" e "30%", e o usuário diz que 20% é o certo, 
                // geralmente o valor da promoção (20%) surge após o cronômetro ou em destaque.
                // Heurística: se houver mais de uma, e uma delas estiver no Cupom, use ela.
                const codeMatch = bannerText.match(/[A-Z]{4,}\d{2,}/);
                const codeVal = codeMatch ? codeMatch[0].match(/\d+/)?.[0] : null;

                if (codeVal && allPercsInBanner.some(p => p.includes(codeVal))) {
                    discountPercent = allPercsInBanner.find(p => p.includes(codeVal)).toUpperCase();
                } else {
                    // Pega a ÚLTIMA porcentagem no banner, que costuma ser a da oferta principal (Ex: "Faltam XX:XX, 20% OFF")
                    discountPercent = allPercsInBanner[allPercsInBanner.length - 1].toUpperCase();
                }

                if (!discountPercent.includes('OFF') && bannerText.toLowerCase().includes('off')) {
                    discountPercent += ' OFF';
                }
            } else {
                // Prioridade 2: Tic-Tac ou Progressivo no texto global
                const tictacMatch = fullText.match(/tic-tac.*?(\d{1,2}%\s*(?:OFF)?)/i);
                if (tictacMatch) {
                    discountPercent = tictacMatch[1].toUpperCase();
                } else {
                    // Prioridade 3: Qualquer XX% ou XX% OFF
                    const percentMatch = fullText.match(/(\d{1,2}%\s*(?:OFF)?)/i);
                    if (percentMatch) discountPercent = percentMatch[1].toUpperCase();
                }
            }

            // Normalização: se for só "20%", adiciona " OFF" se fizer sentido no contexto
            if (discountPercent && !discountPercent.includes('%')) {
                // Safe check for match issues
            } else if (discountPercent && !discountPercent.includes('OFF') && fullText.toLowerCase().includes(discountPercent.toLowerCase() + ' off')) {
                discountPercent += ' OFF';
            }

            // Decisão do Cupom (Mantém suporte a legado mas retorna campos separados)
            let finalCupom = "NO SITE";
            if (discountCode) finalCupom = discountCode;
            else if (discountPercent) finalCupom = discountPercent;

            // 4. Verifica Desconto Progressivo (3 peças 30%, etc)
            // Procura por termos chaves do banner progressivo no CORPO TODO (para garantir)
            const bodyTextFull = document.body.innerText;
            const progressiveKeywords = ['progressivo', '3 peças', '3 pecas', '33% off', '30% off'];
            const hasProgressive = progressiveKeywords.some(kw => bodyTextFull.toLowerCase().includes(kw));

            return {
                encontrado: !!timerContainer,
                timerContainerFound: !!timerContainer,
                ativo: !!timerContainer,
                cupom: finalCupom, // Legacy support
                discountCode: discountCode, // Separado
                discountPercent: discountPercent, // Separado
                tempoRestante: timeStr,
                progressive: hasProgressive,
                rawText: bannerText,
                rawHTML: timerContainer.outerHTML.substring(0, 500) // Para debug
            };
        });

        const result = {
            ativo: timerData.timerContainerFound,
            cupom: timerData.cupom,
            discountCode: timerData.discountCode,
            discountPercent: timerData.discountPercent,
            tempoRestante: timerData.tempoRestante || null,
            progressive: timerData.progressive || false,
            rawHTML: timerData.rawHTML || null
        };

        console.log(`✅ Farm Promo Check: Timer=${result.ativo}, Time=${result.tempoRestante}, Cupom=${result.cupom}, %=${result.discountPercent}`);

        // 🚀 Lógica de Webhook se o Reloginho estiver Ativo
        if (result.ativo) {
            await handleReloginhoWebhook(result);
        }

        return result;

    } catch (error) {
        console.error(`❌ Erro ao verificar timer/promo: ${error.message}`);
        return { ativo: false, progressive: false, cupom: null };
    } finally {
        await browser.close();
    }
}

/**
 * Gerencia o envio do webhook e o estado para evitar duplicidade.
 */
async function handleReloginhoWebhook(data) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

        let lastState = {};
        if (fs.existsSync(STATE_FILE)) {
            lastState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        }

        // Critério de mudança: novo cupom ou mudança significativa no desconto
        const hasChanged = (data.cupom !== lastState.cupom) ||
            (data.discountPercent !== lastState.discountPercent) ||
            (!lastState.lastSent) ||
            (Date.now() - lastState.lastSent > 4 * 60 * 60 * 1000); // Re-envia após 4 horas se ainda ativo

        if (hasChanged) {
            console.log(`[Reloginho] 📢 Mudança detectada ou novo ciclo. Enviando webhook...`);

            const payload = {
                event: "reloginho_detected",
                timestamp: new Date().toISOString(),
                ...data
            };

            await axios.post(WEBHOOK_URL, payload, { timeout: 10000 });

            // Atualiza estado
            fs.writeFileSync(STATE_FILE, JSON.stringify({
                ...data,
                lastSent: Date.now()
            }, null, 2));

            console.log(`[Reloginho] ✅ Webhook enviado e estado atualizado.`);
        } else {
            console.log(`[Reloginho] ⏭️ Mesma promoção detectada anteriormente. Ignorando envio.`);
        }
    } catch (err) {
        console.error(`[Reloginho] ❌ Erro ao processar webhook: ${err.message}`);
    }
}

if (require.main === module) {
    checkFarmTimer();
}

module.exports = { checkFarmTimer };
