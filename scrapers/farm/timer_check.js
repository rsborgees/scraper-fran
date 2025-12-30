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

            // 1. Tenta padrão de texto HH:MM:SS ou HHh MMm SSs
            const bodyText = document.body.innerText;
            const hmsMatch = bodyText.match(/(\d{1,2})[:h]\s*(\d{2})[:m]\s*(\d{2})[s]?/i);

            let timeStr = null;
            if (hmsMatch) {
                timeStr = `${hmsMatch[1].padStart(2, '0')}:${hmsMatch[2]}:${hmsMatch[3]}`;
            } else {
                // 2. Tenta buscar via variáveis CSS (padrão DaisyUI/Tailwind comum na Farm)
                const countdownSpans = Array.from(document.querySelectorAll('.countdown > span, [style*="--value"]'));
                if (countdownSpans.length >= 2) {
                    const values = countdownSpans.map(s => {
                        const val = getComputedStyle(s).getPropertyValue('--value').trim();
                        return val || null;
                    }).filter(v => v !== null && v !== '');

                    if (values.length >= 2) {
                        timeStr = values.map(v => v.padStart(2, '0')).join(':');
                        if (values.length === 2) timeStr = `00:${timeStr}`; // Adiciona horas se vier apenas MM:SS
                    }
                }
            }

            if (!timeStr) return null;

            // 3. Busca desconto ou cupom (QUERO25, 20% OFF, etc)
            // Prioriza elementos no TOPO da página que contenham "tic-tac" e uma porcentagem
            const allElements = Array.from(document.querySelectorAll('*'));
            const ticTacBanner = allElements.find(el => {
                const text = (el.innerText || '').toLowerCase();
                if (text.includes('tic-tac') && /\d+%/.test(text) && el.children.length < 10) {
                    const rect = el.getBoundingClientRect();
                    // O banner tic-tac é fixo no topo ou fica no início da página
                    return rect.top < 250 && rect.height > 0;
                }
                return false;
            });

            let discountText = 'Desconto Ativo';

            if (ticTacBanner) {
                const text = ticTacBanner.innerText;
                const match = text.match(/(\d+%\s*OFF)/i) || text.match(/(\d+%)/);
                if (match) {
                    discountText = match[1].includes('OFF') ? match[1] : match[1] + ' OFF';
                }
            } else {
                // Fallback de segurança: Busca padrão no body mas que comece com tic-tac
                const bodyMatch = bodyText.match(/tic-tac:\s*(\d+%\s*OFF)/i);
                if (bodyMatch) discountText = bodyMatch[1];
            }

            // Adiciona o Cupom se encontrado (REMOVIDO A PEDIDO - Mantendo apenas % OFF)
            /*
            const couponMatch = bodyText.match(/QUERO\d+/i);
            if (couponMatch && !discountText.includes(couponMatch[0])) {
                discountText = `${discountText} (Cupom: ${couponMatch[0]})`;
            }
            */

            // Se ainda for o 10% OFF fantasma, força a busca por algo maior se houver 25% na página
            if (discountText.includes('10%') && bodyText.includes('25%')) {
                discountText = '25% OFF';
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
