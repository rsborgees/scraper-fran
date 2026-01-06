const { chromium } = require('playwright');

/**
 * Inicializa o navegador Chromium com configurações específicas.
 * Versão: 2.1 (Forced Headless para Easypanel)
 * @returns {Promise<{browser: import('playwright').Browser, context: import('playwright').BrowserContext, page: import('playwright').Page}>}
 */
async function initBrowser() {
    console.log('🚀 [V2.2] Iniciando navegador Chromium (MODO VISUAL)...');

    const browser = await chromium.launch({
        headless: false, // Voltando para modo visual para o usuário ver
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo'
    });

    const page = await context.newPage();

    // 🚀 OTIMIZAÇÃO: Mantemos o bloqueio de MEDIA e FONT, mas permitimos IMAGE para o usuário ver
    await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['media', 'font'].includes(type)) {
            return route.abort();
        }
        return route.continue();
    });

    console.log('✅ [V2.2] Navegador iniciado com sucesso.');
    return { browser, context, page };
}

module.exports = { initBrowser };
