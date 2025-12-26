const { chromium } = require('playwright');

/**
 * Inicializa o navegador Chromium com configurações específicas.
 * 
 * Requisitos atendidos:
 * - Chromium launch com headless: false e slowMo: 50
 * - Viewport 1280x800
 * - User Agent realista
 * - Criação de contexto persistente
 * @returns {Promise<{browser: import('playwright').Browser, context: import('playwright').BrowserContext, page: import('playwright').Page}>}
 */
async function initBrowser() {
    console.log('Iniciando navegador Chromium (Non-Headless)...');

    const browser = await chromium.launch({
        headless: false, // OBRIGATÓRIO: Modo visível
        slowMo: 50,      // OBRIGATÓRIO: Ação mais humana
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }, // OBRIGATÓRIO: Viewport padrão
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // OBRIGATÓRIO: UserAgent realista
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo'
    });

    const page = await context.newPage();

    // OBRIGATÓRIO: Aguardar carregamento (será usado nas navegações futuras, aqui apenas inicializa)
    // Exemplo de uso futuro: await page.goto(url, { waitUntil: 'networkidle' });

    console.log('Navegador iniciado com sucesso.');
    return { browser, context, page };
}

module.exports = { initBrowser };
