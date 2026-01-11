const { initBrowser } = require('../../browser_setup');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const DEBUG_DIR = path.join(__dirname, '../../debug');
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
                // Deve conter "faltam" E dígitos no formato de horário ou separados
                return (txt.includes('faltam') || txt.includes('acaba em')) &&
                    (/\d{2}\s*:\s*\d{2}/.test(txt) || /\d{1,2}\s*(?:h|min|s)/.test(txt));
            });

            if (!timerContainer) {
                return { encontrado: false };
            }

            // 2. Extração do Tempo (Busca números dentro do container encontrado)
            const bannerText = getSafeText(timerContainer);
            let timeStr = null;

            // Tenta HH:MM:SS
            const hmsMatch = bannerText.match(/(\d{2})\s*:\s*(\d{2})\s*:\s*(\d{2})/);
            if (hmsMatch) {
                timeStr = `${hmsMatch[1]}:${hmsMatch[2]}:${hmsMatch[3]}`;
            } else {
                // Tenta formato "00 hora 54 minutos..."
                const numbers = bannerText.match(/(\d{1,2})\s*(?:h|hora|min|seg|s)/g);
                if (numbers && numbers.length >= 2) {
                    const cleanNums = numbers.map(s => s.replace(/\D/g, '').padStart(2, '0'));
                    timeStr = cleanNums.join(':');
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

            // Busca porcentagem de destaque (Tic-Tac ou Progressivo ou apenas XX% OFF)
            // Prioriza "tic-tac: 25%OFF"
            const tictacMatch = fullText.match(/tic-tac.*?(\d{1,2}%\s*OFF)/i);
            if (tictacMatch) {
                discountPercent = tictacMatch[1].toUpperCase();
            } else {
                // Tenta geral
                const percentMatch = fullText.match(/(\d{1,2}%\s*OFF)/i);
                if (percentMatch) discountPercent = percentMatch[1].toUpperCase();
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
                rawText: bannerText
            };
        });

        const result = {
            ativo: timerData.timerContainerFound,
            cupom: timerData.cupom,
            discountCode: timerData.discountCode,
            discountPercent: timerData.discountPercent,
            tempoRestante: timerData.tempoRestante || null,
            progressive: timerData.progressive || false
        };

        console.log(`✅ Farm Promo Check: Timer=${result.ativo}, Progressive=${result.progressive}, Cupom=${result.cupom}, %=${result.discountPercent}`);
        return result;

    } catch (error) {
        console.error(`❌ Erro ao verificar timer/promo: ${error.message}`);
        return { ativo: false, progressive: false, cupom: null };
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    checkFarmTimer();
}

module.exports = { checkFarmTimer };
