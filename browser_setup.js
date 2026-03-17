const { chromium } = require('playwright');

/**
 * Inicializa o navegador Chromium com configurações anti-detecção.
 * Versão: 3.0 (Non-Headless + Anti-Detection)
 * @returns {Promise<{browser: import('playwright').Browser, context: import('playwright').BrowserContext, page: import('playwright').Page}>}
 */
async function initBrowser() {
    // Força modo NÃO-headless por padrão (pode ser sobrescrito com HEADLESS=true no .env)
    // Detecta ambiente (Linux = Servidor/Easypanel, Windows/Darwin = Local)
    const isLinux = process.platform === 'linux';

    // Lógica de decisão:
    // 1. Se for Linux (Servidor), FORÇA Headless (true) para evitar crash de "Missing X Server".
    // 2. Se for Local, obedece a variável HEADLESS (padrão true se não definida).
    const envHeadless = process.env.HEADLESS !== 'false';
    const isHeadless = isLinux ? true : envHeadless;

    const mode = isHeadless ? 'HEADLESS (Server Safe)' : 'VISUAL';

    console.log(`🚀 [V3.1] Iniciando navegador Chromium (MODO ${mode})...`);
    if (isLinux) console.log('   ℹ️  Ambiente Linux detectado: Forçando modo Headless.');

    const launchOptions = {
        headless: isHeadless, // true ou false
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-size=1280,800',
            '--disable-extensions',
            '--disable-gpu'
        ]
    };

    if (isHeadless) {
        // Tenta usar o novo modo headless se disponível (melhor para anti-bot)
        // Mas deixa o Playwright gerenciar via opção 'headless: true' ou args
        launchOptions.args.push('--headless=new');
    }

    const browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        permissions: ['geolocation'],
        geolocation: { latitude: -23.5505, longitude: -46.6333 }, // São Paulo, BR
        colorScheme: 'light',
        extraHTTPHeaders: {
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Upgrade-Insecure-Requests': '1'
        }
    });

    const page = await context.newPage();

    // 🛡️ ANTI-DETECÇÃO: Inject scripts para esconder webdriver e simular browser real
    await page.addInitScript(() => {
        // 1. Oculta a propriedade webdriver e outras marcas de automação
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

        // 2. Simula o objeto window.chrome
        window.chrome = {
            runtime: {},
            loadTimes: function () { },
            csi: function () { },
            app: {}
        };

        // 3. Simula plugins, linguagens e hardware
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });

        // Novas máscaras: hardware
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

        // 4. Mock das permissões
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // 5. Spoof de WebGL Vendor/Renderer (Mais realista)
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 37445) return 'Google Inc. (Intel)';
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)';
            return getParameter.apply(this, arguments);
        };

        // 6. Corrige o toString do Navigator e outras consistências
        window.navigator.toString = () => '[object Navigator]';

        // Evita detecção de scripts que buscam por "cdc_" ou canários de automação
        const originalEval = window.eval;
        window.eval = function (str) {
            if (str && str.includes('cdc_')) return null;
            return originalEval.apply(this, arguments);
        };
    });

    // 🚀 OTIMIZAÇÃO: Bloqueia apenas recursos pesados desnecessários
    // DISABLED FOR DEBUGGING: Blocking fonts/media might trigger anti-bots on sensitive sites
    // await page.route('**/*', (route) => {
    //     const type = route.request().resourceType();
    //     if (['media', 'font'].includes(type)) {
    //         return route.abort();
    //     }
    //     return route.continue();
    // });

    console.log(`✅ [V3.0] Navegador iniciado com sucesso (${mode} + Anti-Detection).`);
    return { browser, context, page };
}

module.exports = { initBrowser };
