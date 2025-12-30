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

        // Espera um pouco para banners dinâmicos
        await page.waitForTimeout(5000);

        // Screenshot para debug
        if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
        const screenshotPath = path.join(DEBUG_DIR, `timer_check_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath });

        const timerData = await page.evaluate(() => {
            const getSafeText = (el) => el ? (el.innerText || el.textContent || '').trim() : '';

            // Busca por padrões de tempo HH : MM : SS
            const allElements = Array.from(document.querySelectorAll('*'));
            const timeElement = allElements.find(el =>
                el.children.length === 0 && /\d{2}\s*:\s*\d{2}\s*:\s*\d{2}/.test(getSafeText(el))
            );

            if (!timeElement) return null;

            const tempoRestante = getSafeText(timeElement);

            // Busca por indicação de desconto próxima ao cronômetro
            let container = timeElement.parentElement;
            let desconto = 'Não identificado';
            let limite = 0;

            while (container && limite < 5) {
                const text = getSafeText(container);
                const matchOff = text.match(/(\+\d+%| \d+%)\s*OFF/i);
                if (matchOff) {
                    desconto = matchOff[0];
                    break;
                }
                container = container.parentElement;
                limite++;
            }

            return {
                encontrado: true,
                desconto,
                tempoRestante,
                timestamp: Date.now()
            };
        });

        if (timerData && timerData.encontrado) {
            console.log(`✅ Cronômetro ENCONTRADO: ${timerData.desconto} | Faltam: ${timerData.tempoRestante}`);

            // Calcular horário de término
            const [h, m, s] = timerData.tempoRestante.split(':').map(t => parseInt(t.trim()));
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
