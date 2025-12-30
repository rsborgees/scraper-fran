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
        await page.goto('https://www.farmrio.com.br/', {
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

            // 1. Busca o Container do Timer (Classe específica da Farm)
            const timerBanner = document.querySelector('.campaign-timer-above-header, .campaign-timer, [class*="timer-above-header"]');
            const bannerText = timerBanner ? timerBanner.innerText : '';
            const bodyText = document.body.innerText;

            // 2. Busca o Tempo (HH:MM:SS)
            // Tenta primeiro no banner específico com regex flexível, depois no body todo
            const timeRegex = /\b(\d{1,2})\s*[:h]?\s*(\d{1,2})\s*[:m]?\s*(\d{1,2})\s*s?\b/i;
            let timeStr = null;

            const timeMatch = (bannerText.match(timeRegex)) || (bodyText.match(timeRegex));
            if (timeMatch) {
                timeStr = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}:${timeMatch[3].padStart(2, '0')}`;
            }

            // Fallback via variáveis CSS (DaisyUI/Tailwind)
            if (!timeStr) {
                const countdownSpans = Array.from(document.querySelectorAll('.countdown > span, [style*="--value"]'));
                if (countdownSpans.length >= 2) {
                    const values = countdownSpans.map(s => {
                        const val = getComputedStyle(s).getPropertyValue('--value').trim();
                        return val || null;
                    }).filter(v => v !== null && v !== '');
                    if (values.length >= 2) {
                        timeStr = values.map(v => v.padStart(2, '0')).join(':');
                        if (values.length === 2) timeStr = `00:${timeStr}`;
                    }
                }
            }

            if (!timeStr) return null;

            // 3. Busca Desconto ancorado na palavra "tic-tac"
            let discountText = '25% OFF'; // Fallback padrão da campanha atual

            // Busca específica por "tic-tac: XX%OFF"
            const ticTacMatch = (bannerText.match(/tic-tac[:]?\s*(\d+%\s*(?:OFF)?)/i)) ||
                (bodyText.match(/tic-tac[:]?\s*(\d+%\s*(?:OFF)?)/i));

            if (ticTacMatch) {
                discountText = ticTacMatch[1].trim().toUpperCase();
                if (!discountText.includes('OFF')) discountText += ' OFF';
                discountText = discountText.replace(/(\d+%)OFF/, '$1 OFF');
            } else {
                // Outro padrão comum: "XX% OFF NO TIC-TAC"
                const reverseMatch = bodyText.match(/(\d+%\s*OFF)\s*(?:NO)?\s*TIC-TAC/i);
                if (reverseMatch) discountText = reverseMatch[1].toUpperCase();
            }

            return {
                encontrado: true,
                desconto: discountText,
                tempoRestante: timeStr,
                timestamp: Date.now()
            };
        });

        if (timerData && timerData.encontrado) {
            console.log(`✅ Cronômetro ENCONTRADO: ${timerData.desconto} | Faltam: ${timerData.tempoRestante}`);

            // Calcular horário de término aproximado
            const parts = timerData.tempoRestante.split(':');
            const h = parseInt(parts[0]) || 0;
            const m = parseInt(parts[1]) || 0;
            const s = parseInt(parts[2]) || 0;

            const terminaEm = new Date();
            terminaEm.setHours(terminaEm.getHours() + h);
            terminaEm.setMinutes(terminaEm.getMinutes() + m);
            terminaEm.setSeconds(terminaEm.getSeconds() + s);

            const payload = {
                desconto: timerData.desconto,
                tempo_restante: timerData.tempoRestante,
                termina_as: terminaEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                url: 'https://www.farmrio.com.br/',
                timestamp: new Date().toISOString()
            };

            await axios.post(WEBHOOK_URL, payload);
            console.log('🚀 Webhook enviado com sucesso!');
        } else {
            console.log('info: Nenhum cronômetro detectado nesta rodada.');
        }

    } catch (error) {
        console.error(`❌ Erro ao verificar cronômetro: ${error.message}`);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    checkFarmTimer();
}

module.exports = { checkFarmTimer };
