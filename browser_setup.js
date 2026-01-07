const { chromium } = require('playwright');

/**
 * Inicializa o navegador Chromium com configurações anti-detecção.
 * Versão: 3.0 (Non-Headless + Anti-Detection)
 * @returns {Promise<{browser: import('playwright').Browser, context: import('playwright').BrowserContext, page: import('playwright').Page}>}
 */
async function initBrowser() {
    // Força modo NÃO-headless por padrão (pode ser sobrescrito com HEADLESS=true no .env)
    const isHeadless = process.env.HEADLESS === 'true';
    const mode = isHeadless ? 'HEADLESS' : 'VISUAL';

    console.log(`🚀 [V3.0] Iniciando navegador Chromium (MODO ${mode})...`);

    const browser = await chromium.launch({
        headless: isHeadless,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-size=1280,800',
            '--disable-extensions',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        permissions: ['geolocation'],
        geolocation: { latitude: -23.5505, longitude: -46.6333 }, // São Paulo, BR
        colorScheme: 'light'
    });

    const page = await context.newPage();

    // 🛡️ ANTI-DETECÇÃO: Inject scripts para esconder webdriver
    await page.addInitScript(() => {
        // Hide webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        // Override the permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Pass the Chrome Test
        window.navigator.chrome = {
            runtime: {},
            loadTimes: function () { },
            csi: function () { },
            app: {}
        };

        // Pass the Plugins Length Test
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });

        // Pass the Languages Test
        Object.defineProperty(navigator, 'languages', {
            get: () => ['pt-BR', 'pt', 'en-US', 'en']
        });

        // Pass the iframe Test
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function () {
                return window;
            }
        });

        // Pass toString test
        window.navigator.toString = () => '[object Navigator]';
    });

    // 🚀 OTIMIZAÇÃO: Bloqueia apenas recursos pesados desnecessários
    await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['media', 'font'].includes(type)) {
            return route.abort();
        }
        return route.continue();
    });

    console.log(`✅ [V3.0] Navegador iniciado com sucesso (${mode} + Anti-Detection).`);
    return { browser, context, page };
}

module.exports = { initBrowser };
